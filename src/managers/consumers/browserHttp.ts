import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { genericTypesSymbol, NaniumSerializerCore, responseTypeSymbol } from '../../serializers/core';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription, EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';

export interface NaniumConsumerBrowserHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl: string;
}

export class NaniumConsumerBrowserHttp implements ServiceManager {
	config: NaniumConsumerBrowserHttpConfig;
	private id: string;
	private eventSubscriptions: { [eventName: string]: ConsumerEventSubscription } = {};

	constructor(config?: NaniumConsumerBrowserHttpConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				apiEventUrl: '/events',
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					alert(response);
					return Promise.resolve();
				},
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
				isResponsibleForEvent: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			},
			...(config || {})
		};
	}

	async init(): Promise<void> {
		if (!this.config.apiUrl.startsWith('http')) {
			this.config.apiUrl = window.location.protocol + '//' + window.location.host +
				(this.config.apiUrl.startsWith('/') ? '' : '/') + this.config.apiUrl;
		}
		// every consumer instance gets its own unique id from the server and will use it for every subscription.
		// we get this from the server to prevent browser incompatibilities
		this.id = await this.httpRequest<string>('GET', this.config.apiEventUrl);
		// open long-polling request to receive events, do not use await because it is a long-polling request ;-)
		this.startLongPolling().then();
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors?.length) {
			for (const interceptor of this.config.requestInterceptors) {
				await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
			}
		}

		// execute the request
		return await new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
			try {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.onabort = (e: any): void => {
					reject(e);
				};
				xhr.onerror = (e: any): void => {
					reject(e);
				};
				xhr.onload = async (): Promise<void> => {
					if (xhr.status === 200) {
						const result: any = xhr.response;
						if (result !== null && result !== undefined && result !== '') {
							const r: any = NaniumSerializerCore.plainToClass(
								await this.config.serializer.deserialize(result),
								request.constructor[responseTypeSymbol],
								request.constructor[genericTypesSymbol]
							);
							resolve(r);
						} else {
							resolve();
						}
					} else {
						try {
							this.config.handleError(await this.config.serializer.deserialize(xhr.response)).then(() => {
							}, (e: any) => {
								reject(e);
							});
						} catch (e) {
							reject(e);
						}
					}
				};
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				xhr.setRequestHeader('Content-Type', this.config.serializer.mimeType);
				xhr.send(await this.config.serializer.serialize({ serviceName, request }));
			} catch (e) {
				reject(e);
			}
		});
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = async (): Promise<void> => {
				// interceptors
				for (const interceptor of this.config.requestInterceptors) {
					await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
				}

				// transmission
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				let seenBytes: number = 0;
				xhr.onreadystatechange = async (): Promise<void> => {
					if (xhr.readyState === 3) {
						const r: any = NaniumSerializerCore.plainToClass(
							await this.config.serializer.deserialize(xhr.response.substr(seenBytes)),
							request.constructor[responseTypeSymbol],
							request.constructor[genericTypesSymbol]
						);
						if (Array.isArray(r)) {
							for (const item of r) {
								observer.next(item);
							}
						} else {
							observer.next(r);
						}
						seenBytes = xhr.responseText.length;
					}
				};
				xhr.addEventListener('error', (e: any) => {
					this.config.handleError(e).then(
						() => {
						},
						(e: any) => {
							observer.error(e);
						});
				});
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(await this.config.serializer.serialize({ serviceName, streamed: true, request }));
			};

			core();
		});

	}

	emit(eventName: string, event: any, context: ExecutionContext): any {
		throw new Error('not yet implemented');
	}

	async isResponsibleForEvent(eventName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName);
	}

	async subscribe(eventConstructor: any, handler: EventHandler, retries: number = 0): Promise<void> {
		// try later if the client does not yet have an id
		if (!this.id) {
			return await new Promise<void>((resolve: Function, reject: Function) => {
				if (retries > 10) {
					reject(new Error('subscription not possible: client has no ID'));
				}
				setTimeout(async () => {
					await this.subscribe(eventConstructor, handler, ++retries);
					resolve();
				}, 100);
			});
		}

		const subscription: EventSubscription<any> = {
			clientId: this.id,
			eventName: eventConstructor.eventName,
			additionalData: {}
		};

		// execute interceptors
		for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
			const interceptor: EventSubscriptionSendInterceptor<any, any>
				= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
			await interceptor.execute(eventConstructor, subscription);
		}

		// add basics to eventSubscriptions for this eventName and inform the server
		if (!this.eventSubscriptions.hasOwnProperty(eventConstructor.eventName)) {
			this.eventSubscriptions[eventConstructor.eventName] = {
				eventName: eventConstructor.eventName,
				eventConstructor: eventConstructor,
				eventHandlers: [handler]
			};
			const requestBody: string = await this.config.serializer.serialize(subscription);
			await this.httpRequest<string>('POST', this.config.apiEventUrl, requestBody);
		}
		// if server has already been informed, just add the new handler locally
		else {
			this.eventSubscriptions[eventConstructor.eventName].eventHandlers.push(handler);
		}
	}

	async httpRequest<T>(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<T> {
		return new Promise<T>((resolve: Function, reject: Function) => {
			try {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.onabort = (e) => {
					reject(e);
				};
				xhr.onerror = (e) => {
					reject(e);
				};
				xhr.onload = async (): Promise<void> => {
					if (xhr.status === 200) {
						if (xhr.response !== undefined && xhr.response !== '') {
							resolve(await this.config.serializer.deserialize(xhr.response));
						} else {
							resolve();
						}
					} else {
						if (xhr.response !== undefined && xhr.response !== '') {
							reject(await this.config.serializer.deserialize(xhr.response));
						} else {
							reject();
						}
					}
				};
				xhr.open(method, url);
				for (const key in headers ?? {}) {
					if (headers.hasOwnProperty(key)) {
						xhr.setRequestHeader(key, headers[key]);
					}
				}
				xhr.setRequestHeader('Content-Type', this.config.serializer.mimeType);
				if (method === 'GET') {
					xhr.send();
				} else {
					xhr.send(body);
				}
			} catch (e) {
				reject(e);
			}
		});
	}

	private async startLongPolling(): Promise<void> {
		//todo: events: do this only if a subscription exists - best way: call startLongPolling() not in init but in subscribe if it ist the first subscription
		let eventResponse: NaniumEventResponse;
		try {
			const subscription: EventSubscription = { clientId: this.id };
			for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
				const interceptor: EventSubscriptionSendInterceptor<any, any>
					= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
				await interceptor.execute(undefined, subscription);
			}
			eventResponse = await this.httpRequest<NaniumEventResponse>('POST', this.config.apiEventUrl,
				await this.config.serializer.serialize(subscription));
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			} else {
				// the server is not reachable or something like this so retry at some later time
				//todo: events: at this point send all existing subscriptions with this long-polling request
				setTimeout(() => this.startLongPolling(), 5000);
				return;
			}
		}
		// start next long-polling request no matter if the last one run into timeout or sent an event
		// (the timeout is necessary to prevent growing call stack with each event)
		setTimeout(async () => {
			this.startLongPolling().then();
		});

		// if an event has arrived handle it
		// (the timeout is to get the restart of the long-polling run before the event handling - so the gap with no open is request small)
		if (eventResponse) {
			setTimeout(async () => {
				const eventConstructor: any = this.eventSubscriptions[eventResponse.eventName].eventConstructor;
				// type-save deserialization
				let event: any = NaniumSerializerCore.plainToClass(
					eventResponse.event,
					eventConstructor,
					eventConstructor[genericTypesSymbol]
				);
				// call registered handlers
				if (event) {
					for (const handler of this.eventSubscriptions[eventConstructor.eventName].eventHandlers) {
						event = await handler(event);
						if (event === undefined) {
							break;
						}
					}
				}
			});
		}
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}
}


interface NaniumEventResponse {
	eventName: string;
	event: any;
}

interface ConsumerEventSubscription {
	eventName: string;
	eventConstructor: new (data?: any) => any;
	eventHandlers: Array<EventHandler>;
}

