import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';
import { Observable } from 'rxjs';

import { Nanium } from '../../../core';
import { ChannelConfig } from '../../../interfaces/channelConfig';
import { Channel } from '../../../interfaces/channel';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { randomUUID } from 'crypto';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { NaniumObject, NaniumPropertyInfoCore, responseTypeSymbol } from '../../../objects';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { Message } from '../../../interfaces/communicator';

export interface NaniumHttpChannelConfig extends ChannelConfig {
	server: HttpServer | HttpsServer | { use: Function };
	apiPath?: string;
	eventPath?: string;
	longPollingRequestTimeoutInSeconds?: number;
}

const LPR_TIMEOUT_MS: number = 3000;

export class NaniumHttpChannel implements Channel {
	manager: ServiceProviderManager;
	onClientRemoved: ((clientId) => void)[] = [];

	private readonly config: NaniumHttpChannelConfig;
	private serviceRepository: NaniumRepository;
	private longPollingResponses: { [clientId: string]: ServerResponse } = {};
	private lastLongPollingContact: { [clientId: string]: number } = {};
	private pendingEvents: { [clientId: string]: { eventName: string, event: Event }[] } = {};

	constructor(public id: string, config: NaniumHttpChannelConfig) {
		this.config = {
			...{
				server: undefined,
				apiPath: config.apiPath?.toLowerCase() ?? '/api',
				eventPath: config.eventPath?.toLowerCase() ?? '/events',
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
				longPollingRequestTimeoutInSeconds: 30
			},
			...(config || {})
		};
	}

	private getRootUrl(url) {
		let result = url.split('?')[0].split('#')[0]?.toLowerCase();
		if (result.endsWith('/')) {
			result = result.slice(0, -1);
		}
		return result;
	}

	async init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.manager = manager;

		const handleFunction: (req: IncomingMessage, res: ServerResponse, next?: Function) => Promise<void> =
			async (
				req: IncomingMessage, res: ServerResponse, next?: Function
			): Promise<void> => {
				if (res.writableFinished) {
					return;
				}
				let url: string = this.getRootUrl(req['originalUrl'] || req.url);

				// event subscriptions
				if (url === this.config.eventPath) {
					await this.handleIncomingEventSubscription(req, res);
				}

				// event unsubscriptions
				else if (url === this.config.eventPath + '/delete') {
					await this.handleIncomingEventUnsubscription(req, res);
				}

				// service requests
				else if (req.method.toLowerCase() === 'post' && url === this.config.apiPath) {
					await this.handleIncomingServiceRequest(req, res);
				}

				// something different
				else if (next) {
					next();
				}
			};

		if (typeof this.config.server['use'] === 'function') { // express-like
			this.config.server['use'](handleFunction);
		} else {
			const server: HttpsServer | HttpServer = (this.config.server as HttpServer | HttpsServer);
			const listeners: Function[] = server.listeners('request');
			if (listeners.length === 1 && typeof listeners[0]['use'] === 'function') { // http(s) server from express-like
				listeners[0]['use'](this.config.apiPath, handleFunction);
			} else { // pure http(s) server
				server.addListener('request', handleFunction);
			}
		}
	}

	//#region service request handling
	private async handleIncomingServiceRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const data: any[] = [];
		await new Promise<void>((resolve: Function, reject: Function) => {
			let deserialized: NaniumHttpChannelBody;
			let request: any;
			let parser: MultipartParser;

			const isMultipart = req.headers['content-type']?.startsWith('multipart/form-data');
			if (isMultipart) {
				parser = new MultipartParser(req.headers['content-type'], this.config, this.serviceRepository);
			}
			req.on('data', (chunk: Buffer) => {
				isMultipart ? parser.parsePart(chunk) : data.push(chunk);
			}).on('end', async () => {
				try {
					if (isMultipart) {
						[request, deserialized] = await parser.getResult();
					} else {
						const body: string = Buffer.concat(data).toString();
						deserialized = this.config.serializer.deserialize(body);
						request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
					}
					await this.process(request, res, deserialized.streamed);
					if (
						!deserialized.streamed &&
						!NaniumStream.isNaniumStream(this.serviceRepository[deserialized.serviceName].Request[responseTypeSymbol]) &&
						!NaniumStream.isNaniumStream(this.serviceRepository[deserialized.serviceName].Request[responseTypeSymbol]?.[0])
					) {
						res.end();
						resolve();
					}
				} catch (e) {
					reject(e);
				}
			});
			// }
		});
	}

	async process(request: any, res: ServerResponse, isStreamed?: boolean): Promise<any> {
		return await NaniumHttpChannel.processCore(this.config, this.serviceRepository, request, res, isStreamed);
	}

	static async processCore(config: ChannelConfig, serviceRepository: NaniumRepository, request: any, res: ServerResponse, isStreamed?: boolean): Promise<any> {
		const serviceName: string = request.constructor.serviceName;
		if (!serviceRepository[serviceName]) {
			throw new Error(`nanium: unknown service ${serviceName}`);
		}
		if (isStreamed) {
			if (!request.stream) {
				res.statusCode = 500;
				res.write(config.serializer.serialize('the service does not support result streaming'));
			}
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Connection', 'keep-alive');
			res.flushHeaders(); // flush the headers to establish SSE with client
			const result: Observable<any> = Nanium.stream(request, serviceName, new config.executionContextConstructor({ scope: 'public' }));
			res.statusCode = 200;
			result.subscribe({
				next: async (value: any): Promise<void> => {
					if (
						serviceRepository[serviceName].Request[responseTypeSymbol] === ArrayBuffer ||
						(serviceRepository[serviceName].Request[responseTypeSymbol] && serviceRepository[serviceName].Request[responseTypeSymbol]['naniumBufferInternalValueSymbol'])
					) {
						res.write(await NaniumBuffer.as(Uint8Array, value));
					} else {
						res.write(config.serializer.serialize(value) + '\n' + config.serializer.packageSeparator);
					}
					if (res['flush']) { // if compression is enabled we have to call flush
						res['flush']();
					}
				},
				complete: (): void => {
					res.end();
				},
				error: async (e: any): Promise<void> => {
					res.statusCode = 500;
					res.write(config.serializer.serialize(e));
				}
			});
		} else {
			try {
				res.setHeader('Content-Type', config.serializer.mimeType);
				const result: any = await Nanium.execute(request, serviceName, new config.executionContextConstructor({ scope: 'public' }));
				if (result !== undefined && result !== null) {
					if (
						serviceRepository[serviceName].Request[responseTypeSymbol] === ArrayBuffer ||
						(serviceRepository[serviceName].Request[responseTypeSymbol] && serviceRepository[serviceName].Request[responseTypeSymbol]['naniumBufferInternalValueSymbol'])
					) {
						res.write(await NaniumBuffer.as(Uint8Array, result));
					} else if (
						NaniumStream.isNaniumStream(serviceRepository[serviceName].Request[responseTypeSymbol]) ||
						NaniumStream.isNaniumStream(serviceRepository[serviceName].Request[responseTypeSymbol]?.[0])
					) {
						const stream: NaniumStream = (result as NaniumStream);
						stream
							.onData(chunk => {
								if (NaniumBuffer.isNaniumBuffer(serviceRepository[serviceName].Request[responseTypeSymbol]?.[1])) {
									res.write(chunk);
								} else {
									res.write(config.serializer.serializePartial(chunk));
								}
							})
							.onError(err => {
								res.statusCode = 500;
								res.write(config.serializer.serializePartial(err));
							})
							.onEnd(() => {
								res.end();
							});
						// res.write(config.serializer.serialize(result) + 'response_end\0');
					} else {
						res.write(config.serializer.serialize(result));
					}
				}
				res.statusCode = 200;
			} catch (e) {
				res.statusCode = 500;
				let serialized: string | ArrayBuffer;
				if (e instanceof Error) {
					serialized = config.serializer.serialize({
						message: e.message,
						// stack should not be sent out
					});
				} else {
					serialized = config.serializer.serialize(e);
				}
				res.write(serialized);
			}
		}
	}

	//#endregion service request handling

	//#region event handling
	private async handleIncomingEventSubscription(req: IncomingMessage, res: ServerResponse): Promise<void> {
		// request a unique clientId
		if (req.method.toLowerCase() === 'get') {
			Nanium.logger.info('channel http: incoming client ID request');
			res.statusCode = 200;
			const id: string = randomUUID();
			res.write(this.config.serializer.serialize(id));
			res.end();
			Nanium.logger.info('channel http: sent client ID: ', id);
		}
		// subscription
		else if (req.method.toLowerCase() === 'post') {
			await new Promise<void>((resolve: Function, reject: Function) => {
				const data: any[] = [];
				req.on('data', (chunk: any) => {
					data.push(chunk);
				}).on('end', async () => {
					try {
						// deserialize subscription info
						const subscriptionData: EventSubscription = this.config.serializer.deserialize(Buffer.concat(data).toString());
						subscriptionData.channelId = this.id;
						//todo: create real instances of EventSubscription and additionalData  e.g:
						// const subscriptionData: EventSubscription = NaniumObject.create(
						// 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
						// 	EventSubscription,
						// 	{'TData': this.config.subscriptionDataConstructor}
						// );

						// store subscription information
						if (subscriptionData.eventName) {
							Nanium.logger.info('channel http: incoming event subscription: ', subscriptionData.eventName);
							// ask the manager to execute interceptors and to decide if the subscription is accepted or not
							try {
								await Nanium.receiveSubscription(subscriptionData);
							} catch (e) {
								Nanium.logger.warn(e);
								res.statusCode = 400;
								const responseBody: string | ArrayBuffer = this.config.serializer.serialize(e.message);
								res.write(responseBody);
								res.end();
								resolve();
								return;
							}
							res.end();
							resolve();
						}

						// use keep request open for the long polling mechanism
						else {
							Nanium.logger.info('channel http: new long-polling request from clientId: ', subscriptionData.clientId);
							res.setTimeout(this.config.longPollingRequestTimeoutInSeconds * 1000, () => {
								res.end();
								Nanium.logger.info('channel http: long-polling request from clientId timed out: ', subscriptionData.clientId);
								// todo: self cleaning: delete this.longPollingResponses[subscriptionData.clientId];
							});
							this.longPollingResponses[subscriptionData.clientId] = res;
							this.lastLongPollingContact[subscriptionData.clientId] = Date.now();
							if (Nanium.communicators?.length) {
								for (const com of Nanium.communicators) {
									com.broadcast({ type: 'long_polling_response_received', clientId: subscriptionData.clientId }).then();
								}
							}
							Nanium.logger.info('channel http: open long-polling requests from clientId ', subscriptionData.clientId);
						}
					} catch (e) {
						reject(e);
					}
				});
			});
		}
	}

	private async handleIncomingEventUnsubscription(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (req.method.toLowerCase() !== 'post') {
			return;
		}

		await new Promise<void>((resolve: Function, reject: Function) => {
			const data: any[] = [];
			req.on('data', (chunk: any) => {
				data.push(chunk);
			}).on('end', async () => {
				try {
					// deserialize subscription info
					const subscriptionData: EventSubscription = this.config.serializer.deserialize(Buffer.concat(data).toString());
					//todo: create real instances of EventSubscription and additionalData  e.g:
					// const subscriptionData: EventSubscription = NaniumObject.create(
					// 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
					// 	EventSubscription,
					// 	{'TData': this.config.subscriptionDataConstructor}
					// );

					await Nanium.unsubscribe(subscriptionData);
					resolve();
				} catch (e) {
					reject(e);
				}
			});
		});
		res.statusCode = 200;
		res.end();
	}

	async emitEvent(event: any, subscription?: EventSubscription): Promise<void> {
		Nanium.logger.info('channel http: emitEvent: ', event, subscription);
		await this.emitEventCore(event, subscription);
		//todo: ### change response to boolean?
	}

	async emitEventCore(event: any, subscription: EventSubscription, tryStart?: number): Promise<boolean> {
		// try later if there is no open long-polling response (e.g. because of a recent event transmission)
		if (!this.longPollingResponses[subscription.clientId] || this.longPollingResponses[subscription.clientId].writableFinished) {
			Nanium.logger.info('channel http: emitEventCore: no open long-polling response');

			// if we've tried/waited enough
			if (tryStart && timeDiff(tryStart) > LPR_TIMEOUT_MS) {
				// if nobody had contact, or it is too long ago - remove client
				if (
					!this.lastLongPollingContact[subscription.clientId] ||
					timeDiff(this.lastLongPollingContact[subscription.clientId]) > (LPR_TIMEOUT_MS * 2)
					// if anyone has connection to the client he would use the lpr to send this event,
					// so the client will start a new lpr request immediately and
					// so the last contact can not be much longer ago than the waiting time for the new lpr
					// if so - client has gone
				) {
					this.removeClient(subscription.clientId);
					return;
				}
				return;
			}

			// else remember current event and try again later
			if (event) {
				this.pendingEvents[subscription.clientId] = this.pendingEvents[subscription.clientId] ?? [];
				this.pendingEvents[subscription.clientId].push({ event, eventName: subscription.eventName });
			}
			tryStart = tryStart ?? Date.now();
			return new Promise<boolean>((resolve: Function, _reject: Function) => {
				setTimeout(async () => {
					resolve(await this.emitEventCore(undefined, subscription, tryStart));
				}, 500);
			});
		}

		// else, transmit the data and end the long-polling request
		else {
			Nanium.logger.info('channel http: emitEventCore: transmit the data and end the long-polling request');
			try {
				let responseBody: string | ArrayBuffer;
				// if events are waiting for an open long-polling-request send them together with the current event as array
				if (this.pendingEvents[subscription.clientId]?.length) {
					if (event) {
						this.pendingEvents[subscription.clientId].push({ eventName: subscription.eventName, event });
					}
					responseBody = this.config.serializer.serialize(this.pendingEvents[subscription.clientId]);
				} else {
					responseBody = this.config.serializer.serialize({ eventName: subscription.eventName, event });
				}
				this.longPollingResponses[subscription.clientId].setHeader('Content-Type', 'application/json; charset=utf-8');
				this.longPollingResponses[subscription.clientId].statusCode = 200;
				this.longPollingResponses[subscription.clientId].write(responseBody);
				this.longPollingResponses[subscription.clientId].end();
				delete this.longPollingResponses[subscription.clientId];
				delete this.pendingEvents[subscription.clientId];
			} catch (e) {
			}
			return false;
		}
	}

	receiveCommunicatorMessage(msg: Message): void {
		if (msg.type === 'event_subscribe') {
			const eventMessage = msg as Message<EventSubscription>;
			Nanium.receiveSubscription(eventMessage.data, false).then();
		} else if (msg.type === 'event_unsubscribe') {
			const eventMessage = msg as Message<EventSubscription>;
			Nanium.unsubscribe(eventMessage.data, undefined, false).then();
		} else if (msg.type === 'generic') {
			const message = msg.data as CommunicatorMessage;
			if (message.type === 'long_polling_response_received') {
				this.lastLongPollingContact[message.clientId] = Date.now();
			}
		}
	};

	removeClient?(clientId: string) {
		delete this.longPollingResponses[clientId];
		delete this.pendingEvents[clientId];
		delete this.lastLongPollingContact[clientId];
		for (const handler of this.onClientRemoved) {
			handler(clientId);
		}
	}

	//#endregion event handling
}

interface NaniumHttpChannelBody {
	serviceName: string;
	request: any;
	streamed?: boolean;
}

export class MultipartParser {
	private static fieldValueStart = Buffer.from('\r\n\r\n');
	private static fieldValueEnd = Buffer.from('\r\n');
	private static quote = 34;
	private static space = 32;

	private state: 'searchingBoundary' | 'readingFieldHeader' | 'readingRequest' | 'readingBinary' = 'searchingBoundary';
	private boundary: Buffer;
	private requestBuf: NaniumBuffer;
	private currentBinary: NaniumBuffer;
	private nameStart: number;
	private fieldName: string;
	private dataPortions: Buffer[] = [];

	private tmp: NaniumBuffer = new NaniumBuffer();
	private binaries: { [id: string]: NaniumBuffer } = {};

	constructor(
		private contentType: string,
		private channelConfig: NaniumHttpChannelConfig,
		private serviceRepository: any,
	) {
		this.boundary = Buffer.from(new TextEncoder().encode(
			'--' + contentType.split('multipart/form-data; boundary=')[1]
		));
	}

	async parsePart(data: Buffer) {
		// this.dataPortions prevents parallel parsing of multiple data portions if e.g. the second portion arrives
		// and parsePart is called while the first call of parsePart is waiting of some async operation but is not yet ready
		this.dataPortions.push(data);
		if (this.dataPortions.length > 1) {
			return;
		}

		while (this.dataPortions.length > 0) {
			data = this.dataPortions[0];
			this.tmp.write(data);
			let buf: Buffer;
			let i = 0;
			let valueStart: number;
			if (this.state === 'searchingBoundary' && this.tmp.length < this.boundary.length) {
				return;
			}
			buf = await this.tmp.as(Buffer);
			while (i < buf.length) {
				if (this.state === 'searchingBoundary') {
					if (buf[i] === this.boundary[0] && Buffer.compare(this.boundary, buf.slice(i, i + this.boundary.length)) === 0) {
						i += this.boundary.length;
						this.state = 'readingFieldHeader';
						this.boundary = Buffer.concat([MultipartParser.fieldValueEnd, this.boundary]);
					} else {
						i++;
					}
				} else if (this.state === 'readingFieldHeader') {
					if (buf.slice(i, i + 4).compare(MultipartParser.fieldValueStart) === 0) {
						i += 4;
						if (this.fieldName === 'request') {
							this.requestBuf = new NaniumBuffer();
							this.state = this.state = 'readingRequest';
						} else {
							this.state = 'readingBinary';
							this.currentBinary = new NaniumBuffer();
							this.binaries[this.fieldName] = this.currentBinary;
						}
						this.fieldName = undefined;
					} else if (buf[i] === MultipartParser.space && buf.slice(i, i + 7).toString() === ' name="') { // name (names including " are currently nor allowed)
						this.nameStart = i + 7;
						i += 7;
					} else if (this.nameStart && buf[i] === MultipartParser.quote) { // end of name
						this.fieldName = buf.slice(this.nameStart, i).toString();
						this.nameStart = undefined;
						i++;
					} else {
						i++;
					}
				} else if (this.state === 'readingRequest' || this.state === 'readingBinary') {
					// noinspection JSUnusedAssignment
					valueStart = valueStart ?? i;
					if (buf[i] === this.boundary[0] && Buffer.compare(this.boundary, buf.slice(i, i + this.boundary.length)) === 0) { // next boundary
						if (this.state === 'readingRequest') {
							this.requestBuf.write(buf.slice(valueStart, i));
						} else {
							this.currentBinary.write(buf.slice(valueStart, i));
						}
						valueStart = undefined;
						i += this.boundary.length;
						this.state = 'readingFieldHeader';
					} else if (
						buf[i] === this.boundary[0] &&
						(i + this.boundary.length) > buf.length &&
						Buffer.compare(this.boundary.slice(0, buf.length - i), buf.slice(i, i + buf.length)) === 0
					) {
						// ends with something that looks like a boundary
						// keep the rest in tmp buffer, as prefix of next data portion and stop for current data portion
						if (this.state === 'readingRequest') {
							this.requestBuf.write(buf.slice(valueStart, i));
						} else {
							this.currentBinary.write(buf.slice(valueStart, i));
						}
						this.tmp = new NaniumBuffer(buf.slice(i));
						buf = undefined;
						break;
					} else {
						i++;
					}
				}
			}
			if (this.nameStart && buf) {
				this.tmp = new NaniumBuffer(buf.slice(this.nameStart));
			}
			if (this.state === 'readingRequest' && valueStart && buf) {
				this.requestBuf.write(buf.slice(valueStart));
				this.tmp = new NaniumBuffer();
			}
			if (this.state === 'readingBinary' && valueStart && buf) {
				this.currentBinary.write(buf.slice(valueStart));
				this.tmp = new NaniumBuffer();
			}
			this.dataPortions.shift(); // remove current data portion, when all of it is parsed, so that the next portions can start
		}
	}

	async getResult() {
		const txt = await this.requestBuf.asString();
		const deserialized = this.channelConfig.serializer.deserialize(txt);
		const request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
		NaniumObject.forEachProperty(request, (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => {
			if (
				(typeInfo?.ctor && typeInfo?.ctor['naniumBufferInternalValueSymbol']) ||
				(parent[name[name.length - 1]]?.constructor && parent[name[name.length - 1]]?.constructor['naniumBufferInternalValueSymbol'])
			) {
				parent[name[name.length - 1]].write(this.binaries[parent[name[name.length - 1]].id]);
			}
		});
		return [request, deserialized];
	}
}

class CommunicatorMessage {
	type: 'long_polling_response_received';
	clientId: string;
}

function timeDiff(timestamp: number) {
	return Date.now() - timestamp;
}
