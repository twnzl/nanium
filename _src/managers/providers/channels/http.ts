import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';

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
import * as multipart from 'parse-multipart-data';
import { getPrimaryResponseType, getSecondaryResponseType } from '../../core';

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
			...<NaniumHttpChannelConfig>{
				server: undefined,
				apiPath: config.apiPath?.toLowerCase() ?? '/api',
				eventPath: config.eventPath?.toLowerCase() ?? '/events',
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
				longPollingRequestTimeoutInSeconds: 30,
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

			const isMultipart = req.headers['content-type']?.startsWith('multipart/form-data');
			req.on('data', (chunk: Buffer) => {
				data.push(chunk);
			}).on('end', async () => {
				try {
					if (isMultipart) {
						const body = Buffer.concat(data);
						const boundary = req.headers['content-type'].replace('multipart/form-data; boundary=', '');
						const parts = multipart.parse(body, boundary);
						[request, deserialized] = await this.getMultipartResult(parts);

					} else {
						const body: string = Buffer.concat(data).toString();
						deserialized = this.config.serializer.deserialize(body);
						request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
					}
					await this.process(request, req, res);
					if (
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
		});
	}

	async getMultipartResult(parts: any[]) {
		const txt = parts.find(p => p.name === 'request').data.toString();
		const deserialized = this.config.serializer.deserialize(txt);
		const request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
		NaniumObject.forEachProperty(request, (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => {
			if (
				(typeInfo?.ctor && typeInfo?.ctor['naniumBufferInternalValueSymbol']) ||
				(parent[name[name.length - 1]]?.constructor && parent[name[name.length - 1]]?.constructor['naniumBufferInternalValueSymbol'])
			) {
				const binaryId = parent[name[name.length - 1]].id;
				parent[name[name.length - 1]].write(parts.find(p => p.name === binaryId).data);
			}
		});
		return [request, deserialized];
	}

	async process(request: any, req: IncomingMessage, res: ServerResponse): Promise<any> {
		return await NaniumHttpChannel.processCore(this.config, this.serviceRepository, request, req, res);
	}

	static async processCore(config: ChannelConfig, serviceRepository: NaniumRepository, request: any, req: IncomingMessage, res: ServerResponse): Promise<any> {
		const serviceName: string = request.constructor.serviceName;
		let ResponseType = getPrimaryResponseType(serviceRepository, serviceName);
		try {
			res.setHeader('Content-Type', config.serializer.mimeType);
			const executionContext = new config.executionContextConstructor({
				scope: 'public',
				source: this.getClientIp(req)
			});
			const result: any = await Nanium.execute(request, serviceName, executionContext);
			if (result !== undefined && result !== null) {
				if (NaniumBuffer.isNaniumBuffer(ResponseType)) {
					res.write(await NaniumBuffer.as(Uint8Array, result));
				} else if (NaniumStream.isNaniumStream(ResponseType)) {
					const stream: NaniumStream = (result as NaniumStream);
					stream
						.onData(chunk => {
							if (NaniumBuffer.isNaniumBuffer(getSecondaryResponseType(serviceRepository, serviceName))) {
								if (chunk instanceof NaniumBuffer) {
									(chunk as NaniumBuffer).asUint8Array().then(buffer => res.write(buffer));
								} else {
									res.write(chunk);
								}
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

	static getClientIp(req: IncomingMessage): string {
		const forwardedFor = req.headers['x-forwarded-for'];
		if (forwardedFor && typeof forwardedFor === 'string') {
			return forwardedFor.split(',')[0].trim();
		}
		return req.socket.remoteAddress;
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
						subscriptionData.source = NaniumHttpChannel.getClientIp(req);
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
								res.statusCode = 400;
								const responseBody: string | ArrayBuffer = this.config.serializer.serialize(e);
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
					subscriptionData.source = NaniumHttpChannel.getClientIp(req);
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
		} else if (msg.type === 'remove_client') {
			const eventMessage = msg as Message<string>;
			Nanium.removeClient(eventMessage.data, false).then();
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
		Nanium.removeClient(clientId).then();
	}

	//#endregion event handling
}

interface NaniumHttpChannelBody {
	serviceName: string;
	request: any;
}

class CommunicatorMessage {
	type: 'long_polling_response_received';
	clientId: string;
}

function timeDiff(timestamp: number) {
	return Date.now() - timestamp;
}
