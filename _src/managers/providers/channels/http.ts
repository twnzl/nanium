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


export interface NaniumHttpChannelConfig extends ChannelConfig {
	server: HttpServer | HttpsServer | { use: Function };
	apiPath?: string;
	eventPath?: string;
	longPollingRequestTimeoutInSeconds?: number;
}

export class NaniumHttpChannel implements Channel {
	private serviceRepository: NaniumRepository;
	private readonly config: NaniumHttpChannelConfig;
	private longPollingResponses: { [clientId: string]: ServerResponse } = {};

	public eventSubscriptions: { [eventName: string]: EventSubscription[] } = {};

	constructor(config: NaniumHttpChannelConfig) {
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

	async init(serviceRepository: NaniumRepository): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.eventSubscriptions = {};

		const handleFunction: (req: IncomingMessage, res: ServerResponse, next?: Function) => Promise<void> =
			async (
				req: IncomingMessage, res: ServerResponse, next?: Function
			): Promise<void> => {
				if (res.writableFinished) {
					return;
				}
				const url: string = req['originalUrl'] || req.url;

				// event subscriptions
				if ((url).split('?')[0].split('#')[0]?.toLowerCase() === this.config.eventPath) {
					await this.handleIncomingEventSubscription(req, res);
				}

				// event unsubscriptions
				else if (url.split('?')[0].split('#')[0]?.toLowerCase() === this.config.eventPath + '/delete') {
					await this.handleIncomingEventUnsubscription(req, res);
				}

				// service requests
				else if (req.method.toLowerCase() === 'post' && url.split('?')[0].split('#')[0]?.toLowerCase() === this.config.apiPath) {
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
					if (!deserialized.streamed) {
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
						serviceRepository[serviceName].Request[responseTypeSymbol]?.name === NaniumBuffer.name
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
						serviceRepository[serviceName].Request[responseTypeSymbol]?.name === NaniumBuffer.name
					) {
						res.write(await NaniumBuffer.as(Uint8Array, result));
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
								Nanium.logger.error(e);
								res.statusCode = 400;
								const responseBody: string | ArrayBuffer = this.config.serializer.serialize(e.message);
								res.write(responseBody);
								res.end();
								resolve();
								return;
							}
							this.eventSubscriptions[subscriptionData.eventName] = this.eventSubscriptions[subscriptionData.eventName] ?? [];
							this.eventSubscriptions[subscriptionData.eventName].push(subscriptionData);
							res.end();
							Nanium.logger.info('channel http: event subscription successful');
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
		if (!this.eventSubscriptions || req.method.toLowerCase() !== 'post') {
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

					if (!this.eventSubscriptions[subscriptionData.eventName]) {
						resolve();
					}
					const idx: number = this.eventSubscriptions[subscriptionData.eventName].findIndex(s => s.clientId === subscriptionData.clientId);
					if (idx >= 0) {
						this.eventSubscriptions[subscriptionData.eventName].splice(idx, 1);
					}
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
		const promises: Promise<void>[] = [];
		promises.push(this.emitEventCore(event, subscription));
		await Promise.all(promises);
	}

	async emitEventCore(event: any, subscription?: EventSubscription, tryCount: number = 0): Promise<void> {
		// try later if there is no open long-polling response (e.g. because of a recent event transmission)
		if (!this.longPollingResponses[subscription.clientId] || this.longPollingResponses[subscription.clientId].writableFinished) {
			Nanium.logger.info('channel http: emitEventCore: no open long-polling response');
			if (tryCount > 5) {
				// client seams to be gone, so remove subscription from this client
				for (const eventName in this.eventSubscriptions) {
					if (this.eventSubscriptions.hasOwnProperty(eventName)) {
						Nanium.logger.info('channel http: emitEventCore: client seams to be gone, so remove subscription from client: ' + subscription.clientId);
						this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName].filter((s) => s.clientId !== subscription.clientId);
					}
				}
				delete this.longPollingResponses[subscription.clientId];
				return;
			}
			return new Promise<void>((resolve: Function, _reject: Function) => {
				setTimeout(async () => {
					resolve(await this.emitEventCore(event, subscription, ++tryCount));
				}, 500);
			});
		}

		// else, transmit the data and end the long-polling request
		else {
			Nanium.logger.info('channel http: emitEventCore: transmit the data and end the long-polling request');
			try {
				const responseBody: string | ArrayBuffer = this.config.serializer.serialize({
					eventName: event.constructor.eventName,
					event
				});
				this.longPollingResponses[subscription.clientId].setHeader('Content-Type', 'application/json; charset=utf-8');
				this.longPollingResponses[subscription.clientId].statusCode = 200;
				this.longPollingResponses[subscription.clientId].write(responseBody);
				this.longPollingResponses[subscription.clientId].end();
			} catch (e) {
			}
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
		this.tmp.write(data);
		let buf: Buffer;
		let i = 0;
		let valueStart: number;
		if (this.state === 'searchingBoundary' && this.tmp.length < this.boundary.length) {
			return;
		}
		buf = Buffer.from((await this.tmp.asUint8Array()).buffer);
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
				} else {
					i++;
				}
			}
		}
		if (this.nameStart) {
			this.tmp = new NaniumBuffer(buf.slice(this.nameStart));
		}
		if (this.state === 'readingRequest' && valueStart) {
			this.requestBuf.write(buf.slice(valueStart));
		}
		if (this.state === 'readingBinary' && valueStart) {
			this.currentBinary.write(buf.slice(valueStart));
		}
	}

	async getResult() {
		const txt = await this.requestBuf.asString();
		const deserialized = this.channelConfig.serializer.deserialize(txt);
		const request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
		NaniumObject.forEachProperty(request, (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => {
			if (typeInfo?.ctor?.name === NaniumBuffer.name || parent[name[name.length - 1]]?.constructor?.name === NaniumBuffer.name) {
				parent[name[name.length - 1]].write(this.binaries[parent[name[name.length - 1]].id]);
			}
		});
		return [request, deserialized];
	}
}
