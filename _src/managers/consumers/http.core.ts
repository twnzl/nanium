import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';
import { genericTypesSymbol, NaniumObject, NaniumPropertyInfoCore, responseTypeSymbol } from '../../objects';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { Nanium } from '../../core';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { ExecutionContext } from '../../interfaces/executionContext';

interface NaniumEventResponse {
	eventName: string;
	event?: any;
	error?: string;
}

interface ConsumerEventSubscription {
	eventName: string;
	eventConstructor: new (data?: any) => any;
	eventHandlers: Map<number, EventHandler>;
}

interface NaniumHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl?: string;
	onServerConnectionRestored?: () => void;
	executionContextConstructor?: new (data: ExecutionContext) => ExecutionContext;
}

export class HttpCore {
	public id: string;
	public eventSubscriptions: { [eventName: string]: ConsumerEventSubscription };
	public terminated: boolean = false;

	constructor(
		public config: NaniumHttpConfig,
		private httpRequest: (method: 'GET' | 'POST', url: string, body?: string | ArrayBuffer | FormData, headers?: any) => Promise<ArrayBuffer>
	) {
	}

	public async sendRequest(serviceName: string, request: any): Promise<any> {
		const uri: string = new URL(this.config.apiUrl).toString() + '?' + serviceName;
		const buffers: NaniumBuffer[] = [];
		let body: string | ArrayBuffer | FormData = this.config.serializer.serialize({ serviceName, request });
		NaniumObject.forEachProperty(request, (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => {
			if (
				(typeInfo?.ctor && typeInfo?.ctor['naniumBufferInternalValueSymbol']) ||
				(parent[name[name.length - 1]]?.constructor && parent[name[name.length - 1]]?.constructor['naniumBufferInternalValueSymbol'])
			) {
				const buffer = parent[name[name.length - 1]];
				if (buffer) {
					buffers.push(buffer);
				}
			}
		});
		try {
			// handle binary data included in the request
			if (buffers.length) {
				const tmp = body as string;
				body = new FormData();
				body.append('request', tmp);

				for (const buffer of buffers) {
					body.append(buffer.id, new Blob([await buffer.asUint8Array()]));
				}
			}

			// send the request
			const data: ArrayBuffer = await this.httpRequest('POST', uri, body);
			if (data === undefined || data === null) {
				return data;
			} else if (data.byteLength === 0) {
				return request.constructor[responseTypeSymbol] !== String ? undefined : data;
			}
			if (request.constructor[responseTypeSymbol] === ArrayBuffer) {
				return data;
			} else if (
				request.constructor[responseTypeSymbol] === ArrayBuffer ||
				(request.constructor[responseTypeSymbol] && request.constructor[responseTypeSymbol]['naniumBufferInternalValueSymbol'])
			) {
				return data.constructor['naniumBufferInternalValueSymbol'] ? data : new NaniumBuffer(data);
			} else {
				const r: any = NaniumObject.create(
					this.config.serializer.deserialize(data),
					request.constructor[responseTypeSymbol],
					request.constructor[genericTypesSymbol]
				);
				return r;
			}
		} catch (e) {
			let error: any;
			if (e instanceof ArrayBuffer) {
				error = new TextDecoder().decode(e);
			} else {
				error = e;
			}
			if (typeof error === 'string') {
				const deserialized: any = this.config.serializer.deserialize(e);
				// todo: make an Error class configurable so that NaniumObject.create can also be used for Error Objects.
				if (this.config.handleError) {
					await this.config.handleError(deserialized);
				} else {
					throw deserialized;
				}
			} else {
				throw e;
			}
		}
	}

	async subscribe(eventConstructor: any, handler: EventHandler): Promise<EventSubscription> {
		return await new Promise<EventSubscription>(async (resolve: Function, reject: Function) => {
			// if not yet done, open long-polling request to receive events, do not use await because it is a long-polling request ;-)
			if (!this.eventSubscriptions) {
				this.eventSubscriptions = {};
				this.startLongPolling().then();
			}
			let retries: number = 0;
			const core: () => void = () => {
				// try later if the client does not yet have an id (the startLongPolling function will retry to get the id meanwhile)
				if (!this.id) {
					if (retries > 10) {
						reject(new Error('subscription not possible: client has no ID'));
						return;
					} else {
						retries++;
						setTimeout(async () => core(), 1000);
						return;
					}
				}
				const subscription: EventSubscription = new EventSubscription(this.id, eventConstructor.eventName);

				// add basics to eventSubscriptions for this eventName and inform the server
				if (!this.eventSubscriptions.hasOwnProperty(eventConstructor.eventName)) {
					this.eventSubscriptions[eventConstructor.eventName] = {
						eventName: eventConstructor.eventName,
						eventConstructor: eventConstructor,
						eventHandlers: new Map<number, EventHandler>()
					};
					this.eventSubscriptions[eventConstructor.eventName].eventHandlers.set(subscription.id, handler);
					this.sendEventSubscription(eventConstructor, subscription).then(
						() => resolve(subscription),
						(e) => reject(e)
					);
				}

				// if server has already been informed, just add the new handler locally
				else {
					this.eventSubscriptions[eventConstructor.eventName].eventHandlers.set(subscription.id, handler);
					resolve(subscription);
				}
			};

			core();
		});
	}

	private async sendEventSubscription(eventConstructor: any, subscription: EventSubscription<any>): Promise<void> {
		for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
			const interceptor: EventSubscriptionSendInterceptor<any, any>
				= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
			await interceptor.execute(eventConstructor, subscription);
		}
		const requestBody: string | ArrayBuffer = this.config.serializer.serialize(subscription);
		try {
			await this.httpRequest('POST', this.config.apiEventUrl + '?' + subscription.eventName, requestBody);
		} catch (e) {
			const error = this.config.serializer.deserialize(e);
			throw error;
		}
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		if (!this.eventSubscriptions) {
			return;
		}
		eventName = subscription?.eventName ?? eventName;
		if (subscription) {
			this.eventSubscriptions[eventName]?.eventHandlers?.delete(subscription.id);
		}
		if (!subscription || !this.eventSubscriptions[eventName]?.eventHandlers?.size) {
			subscription = subscription ?? new EventSubscription(this.id, eventName);
			for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
				const interceptor: EventSubscriptionSendInterceptor<any, any>
					= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
				await interceptor.execute(this.eventSubscriptions[eventName].eventConstructor, subscription);
			}
			const requestBody: string | ArrayBuffer = this.config.serializer.serialize({
				clientId: this.id,
				eventName: eventName,
				additionalData: subscription.additionalData,
				id: subscription.id
			});
			delete this.eventSubscriptions[eventName];
			const error: ArrayBuffer = await this.httpRequest('POST', this.config.apiEventUrl + '/delete' + '?' + eventName, requestBody);
			if (error.byteLength) {
				Nanium.logger.error(this.config.serializer.deserialize(error));
				return;
			}
		}
	}

	// every consumer instance gets its own unique id from the server and will use it for every subscription.
	// we get this from the server to prevent browser incompatibilities
	private async trySetClientId(): Promise<boolean> {
		if (this.id) {
			return true;
		}
		let response;
		try {
			response = await this.httpRequest('GET', this.config.apiEventUrl + '?');
		} catch (e) {
			return false;
		}
		this.id = this.config.serializer.deserialize(response);
		return true;
	}

	private async startLongPolling(resendSubscriptions: boolean = false): Promise<void> {
		if (this.terminated) {
			return;
		}
		let eventResponse: NaniumEventResponse;
		try {
			if (!(await this.trySetClientId())) {
				setTimeout(() => this.startLongPolling(true), 5000);
				return;
			}
			if (resendSubscriptions) {
				let subscription: EventSubscription;
				for (const eventName in this.eventSubscriptions) {
					if (this.eventSubscriptions.hasOwnProperty(eventName)) {
						subscription = new EventSubscription(this.id, eventName);
						await this.sendEventSubscription(this.eventSubscriptions[eventName].eventConstructor, subscription);
					}
				}
				await this.config.onServerConnectionRestored();
			}
			const eventResponseString: string | ArrayBuffer = await this.httpRequest('POST', this.config.apiEventUrl,
				this.config.serializer.serialize({ clientId: this.id }));
			if (eventResponseString) {
				eventResponse = this.config.serializer.deserialize(eventResponseString);
			}
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			} else if (!this.terminated) {
				// the server is not reachable or something like this so retry at some later time and resend subscriptions (true)
				setTimeout(() => this.startLongPolling(true), 5000);
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
				const eventConstructor: any = this.eventSubscriptions[eventResponse.eventName]?.eventConstructor;
				if (eventConstructor) {
					// type-save deserialization
					const event: any = NaniumObject.create(
						eventResponse.event,
						eventConstructor,
						eventConstructor[genericTypesSymbol]
					);
					// call registered handlers
					if (event) {
						for (const handler of this.eventSubscriptions[eventConstructor.eventName].eventHandlers.values()) {
							await handler(event);
						}
					}
				}
			});
		}
	}
}
