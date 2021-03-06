import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { Nanium } from '../../core';

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
}

export class HttpCore {
	public id: string;
	public eventSubscriptions: { [eventName: string]: ConsumerEventSubscription };
	public terminated: boolean = false;

	constructor(
		public config: NaniumHttpConfig,
		private httpRequest: (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => Promise<string>
	) {
	}

	public async sendRequest(serviceName: string, request: any): Promise<any> {
		const uri: string = new URL(this.config.apiUrl).toString() + '?' + serviceName;
		const bodyString: string = await this.config.serializer.serialize({ serviceName, request });
		try {
			const str: string = await this.httpRequest('POST', uri, bodyString);
			if (str === undefined || str === null) {
				return str;
			} else if (str === '') {
				return request.constructor[responseTypeSymbol] !== String ? undefined : str;
			}
			const r: any = NaniumObject.plainToClass(
				await this.config.serializer.deserialize(str),
				request.constructor[responseTypeSymbol],
				request.constructor[genericTypesSymbol]
			);
			return r;
		} catch (e) {
			if (typeof e === 'string') {
				const deserialized: any = await this.config.serializer.deserialize(e);
				// todo: make an Error class configurable so that plainToClass can also be used for Error Objects.
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

				// execute interceptors

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
						() => core()
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
		const requestBody: string = await this.config.serializer.serialize(subscription);
		try {
			await this.httpRequest('POST', this.config.apiEventUrl, requestBody);
		} catch (e) {
			setTimeout(() => this.sendEventSubscription(eventConstructor, subscription), 1000);
		}
	}

	async unsubscribe(subscription?: EventSubscription): Promise<void> {
		const eventName: string = subscription.eventName;
		if (!this.eventSubscriptions) {
			return;
		}
		if (subscription) {
			this.eventSubscriptions[eventName]?.eventHandlers?.delete(subscription.id);
		}
		if (!subscription || this.eventSubscriptions[eventName]?.eventHandlers?.size === 0) {
			const requestBody: string = await this.config.serializer.serialize({
				clientId: this.id,
				eventName: subscription.eventName,
				additionalData: {}
			});
			delete this.eventSubscriptions[eventName];
			const error: string = await this.httpRequest('POST', this.config.apiEventUrl + '/delete', requestBody);
			if (error) {
				Nanium.logger.error(await this.config.serializer.deserialize(error));
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
		try {
			this.id = await this.config.serializer.deserialize(
				await this.httpRequest('GET', this.config.apiEventUrl));
			return true;
		} catch (e) {
			return false;
		}
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
			const eventResponseString: string = await this.httpRequest('POST', this.config.apiEventUrl,
				await this.config.serializer.serialize({ clientId: this.id }));
			if (eventResponseString) {
				eventResponse = await this.config.serializer.deserialize(eventResponseString);
			}
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			} else {
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
				const eventConstructor: any = this.eventSubscriptions[eventResponse.eventName].eventConstructor;
				// type-save deserialization
				const event: any = NaniumObject.plainToClass(
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
			});
		}
	}
}
