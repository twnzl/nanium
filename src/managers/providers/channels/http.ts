import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';
import { Observable } from 'rxjs';

import { Nanium } from '../../../core';
import { ChannelConfig } from '../../../interfaces/channelConfig';
import { Channel } from '../../../interfaces/channel';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { NaniumSerializerCore } from '../../../serializers/core';
import { randomUUID } from 'crypto';
import { ServiceExecutionContext } from '../../../interfaces/serviceExecutionContext';

export interface NaniumHttpChannelConfig extends ChannelConfig {
	server: HttpServer | HttpsServer;
	apiPath?: string;
	eventPath?: string;
	longPollingRequestTimeoutInSeconds?: number; // seconds
}

export class NaniumHttpChannel implements Channel {
	private serviceRepository: NaniumRepository;
	private readonly config: NaniumHttpChannelConfig;
	private eventSubscriptions: { [clientId: string]: NaniumEventSubscription } = {};

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
		this.config.server.listeners('request').forEach((listener: (...args: any[]) => void) => {
			this.config.server.removeListener('request', listener);
			this.config.server.on('request', async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
				// original listener
				listener(req, res);

				// event registrations
				if (req.url.split('?')[0].split('#')[0]?.toLowerCase() === this.config.eventPath) {
					// request a unique clientId
					if (req.method.toLowerCase() === 'get') {
						res.write(await this.config.serializer.serialize(randomUUID()));
						res.end();
					}
					// subscription
					else if (req.method.toLowerCase() === 'post') {
						await new Promise<void>((resolve: Function, reject: Function) => {
							const data: any[] = [];
							req.on('data', (chunk: any) => {
								data.push(chunk);
							}).on('end', async () => {
								try {
									// todo: events: authorization - only accept subscriptions from authorized clients
									const [clientId, eventName]: [string, string] = Buffer.concat(data).toString().split('\0') as [string, string];
									// use keep request open for the long polling mechanism
									if (!eventName) {
										res.setTimeout(this.config.longPollingRequestTimeoutInSeconds * 1000, () => {
											res.end();
										});
										this.eventSubscriptions[clientId] = this.eventSubscriptions[clientId] ?? {
											context: undefined,
											httpResponse: undefined,
											subscribedEvents: []
										};
										this.eventSubscriptions[clientId].httpResponse = res;
									}

									// register event
									else {
										this.eventSubscriptions[clientId] = this.eventSubscriptions[clientId] ?? {
											context: {}, // todo: events: remember to use it later for the execution of event interceptors (get it from header)
											httpResponse: res,
											subscribedEvents: []
										};
										if (!this.eventSubscriptions[clientId].subscribedEvents.includes(eventName)) {
											this.eventSubscriptions[clientId].subscribedEvents.push(eventName);
										}
										res.end();
										resolve();
									}
								} catch (e) {
									reject(e);
								}
							});
						});
					}
				}

				// service requests
				if (req.method.toLowerCase() === 'post' && req.url.split('?')[0].split('#')[0]?.toLowerCase() === this.config.apiPath) {
					const data: any[] = [];
					await new Promise<void>((resolve: Function, reject: Function) => {
						req.on('data', (chunk: any) => {
							data.push(chunk);
						}).on('end', async () => {
							try {
								const body: string = Buffer.concat(data).toString();
								const deserialized: NaniumHttpChannelBody = await this.config.serializer.deserialize(body);
								await this.process(deserialized, res);
								res.end();
								resolve();
							} catch (e) {
								reject(e);
							}
						});
					});
				}
			});
		});
	}

	async process(deserialized: NaniumHttpChannelBody, res: ServerResponse): Promise<any> {
		return await NaniumHttpChannel.processCore(this.config, this.serviceRepository, deserialized, res);
	}

	static async processCore(config: ChannelConfig, serviceRepository: NaniumRepository, deserialized: NaniumHttpChannelBody, res: ServerResponse): Promise<any> {
		const serviceName: string = deserialized.serviceName;
		const request: any = NaniumSerializerCore.plainToClass(deserialized.request, serviceRepository[serviceName].Request);
		if (deserialized.streamed) {
			if (!request.stream) {
				res.statusCode = 500;
				res.write(await config.serializer.serialize('the service does not support result streaming'));
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
					res.write(await config.serializer.serialize(value) + '\n');
					if (res['flush']) { // if compression is enabled we have to call flush
						res['flush']();
					}
				},
				complete: (): void => {
					res.end();
				},
				error: async (e: any): Promise<void> => {
					res.statusCode = 500;
					res.write(await config.serializer.serialize(e));
				}
			});
		} else {
			try {
				res.setHeader('Content-Type', config.serializer.mimeType);
				const result: any = await Nanium.execute(request, serviceName, new config.executionContextConstructor({ scope: 'public' }));
				if (result !== undefined && result !== null) {
					res.write(await config.serializer.serialize(result));
				}
				res.statusCode = 200;
			} catch (e) {
				res.statusCode = 500;
				res.write(await config.serializer.serialize(e));
			}
		}
	}

	async emitEvent(event: any, context: ServiceExecutionContext, clientId?: string): Promise<void> {
		const promises: Promise<void>[] = [];
		if (clientId) {
			promises.push(this.emitEventCore(event, context, clientId));
		} else {
			for (const cid in this.eventSubscriptions) {
				if (this.eventSubscriptions.hasOwnProperty(cid)) {
					promises.push(this.emitEventCore(event, context, cid));
				}
			}
		}
		await Promise.all(promises);
		return;
	}

	async emitEventCore(event: any, context: ServiceExecutionContext, clientId: string): Promise<void> {
		if (!this.eventSubscriptions.hasOwnProperty(clientId)) {
			return;
		}
		if (this.eventSubscriptions[clientId].subscribedEvents.includes(event.constructor.eventName)) {
			// todo: events: for each event interceptor event = interceptor.execute(event, context, client)
			// try later if there is no open long-polling response (e.g. because of a recent event transmission)
			if (!this.eventSubscriptions[clientId].httpResponse || this.eventSubscriptions[clientId].httpResponse.writableFinished) {
				setTimeout(() => this.emitEvent(event, context, clientId), 100);
			} else {
				try {
					this.eventSubscriptions[clientId].httpResponse.setHeader('Content-Type', 'application/json; charset=utf-8');
					this.eventSubscriptions[clientId].httpResponse.statusCode = 200;
					this.eventSubscriptions[clientId].httpResponse.write(await this.config.serializer.serialize({
						event,
						eventName: event.constructor.eventName
					}));
					this.eventSubscriptions[clientId].httpResponse.end();
				} catch (e) {
				}
			}
		}
	}

}

interface NaniumHttpChannelBody {
	serviceName: string;
	request: any;
	streamed?: boolean;
}

interface NaniumEventSubscription {
	context: ServiceExecutionContext;
	httpResponse: ServerResponse;
	subscribedEvents: string[];
}
