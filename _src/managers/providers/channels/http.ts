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
import { NaniumObject, responseTypeSymbol } from '../../../objects';

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
			req.on('data', (chunk: any) => {
				data.push(chunk);
			}).on('end', async () => {
				try {
					const body: string = Buffer.concat(data).toString();
					const deserialized: NaniumHttpChannelBody = this.config.serializer.deserialize(body);
					await this.process(deserialized, res);
					if (!deserialized.streamed) {
						res.end();
						resolve();
					}
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	async process(deserialized: NaniumHttpChannelBody, res: ServerResponse): Promise<any> {
		return await NaniumHttpChannel.processCore(this.config, this.serviceRepository, deserialized, res);
	}

	static async processCore(config: ChannelConfig, serviceRepository: NaniumRepository, deserialized: NaniumHttpChannelBody, res: ServerResponse): Promise<any> {
		const serviceName: string = deserialized.serviceName;
		if (!serviceRepository[serviceName]) {
			throw new Error(`nanium: unknown service ${serviceName}`);
		}
		const request: any = NaniumObject.create(deserialized.request, serviceRepository[serviceName].Request);
		if (deserialized.streamed) {
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
					if (serviceRepository[serviceName].Request[responseTypeSymbol] === ArrayBuffer) {
						if (value instanceof Buffer || value instanceof Uint8Array) {
							res.write(value);
						} else {
							res.write(new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer));
						}
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
					if (serviceRepository[serviceName].Request[responseTypeSymbol] === ArrayBuffer) {
						if (result instanceof Buffer || result instanceof Uint8Array) {
							res.write(result);
						} else {
							res.write(new Uint8Array(result instanceof ArrayBuffer ? result : result.buffer));
						}
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
