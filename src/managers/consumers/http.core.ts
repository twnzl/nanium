import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription, EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';
import { genericTypesSymbol, NaniumSerializerCore, responseTypeSymbol } from '../../serializers/core';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';

interface NaniumEventResponse {
	eventName: string;
	event: any;
}

interface ConsumerEventSubscription {
	eventName: string;
	eventConstructor: new (data?: any) => any;
	eventHandlers: Array<EventHandler>;
}

interface NaniumHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl: string;
}

export class HttpCore {
	public id: string;
	public eventSubscriptions: { [eventName: string]: ConsumerEventSubscription };

	constructor(
		public config: NaniumHttpConfig,
		private httpRequest: (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => Promise<string>
	) {
	}

	public async sendRequest(serviceName: string, request: any): Promise<any> {
		const uri: string = new URL(this.config.apiUrl).toString() + '#' + serviceName;
		const bodyString: string = await this.config.serializer.serialize({ serviceName, request });
		const str: string = await this.httpRequest('POST', uri, bodyString);
		const r: any = NaniumSerializerCore.plainToClass(
			await this.config.serializer.deserialize(str),
			request.constructor[responseTypeSymbol],
			request.constructor[genericTypesSymbol]);
		return r;
	}

	async subscribe(eventConstructor: any, handler: EventHandler, retries: number = 0): Promise<void> {
		// if not yet done, open long-polling request to receive events, do not use await because it is a long-polling request ;-)
		if (!this.eventSubscriptions) {
			this.eventSubscriptions = {};
			this.startLongPolling().then();
		}

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
			await this.httpRequest('POST', this.config.apiEventUrl, requestBody);
		}
// if server has already been informed, just add the new handler locally
		else {
			this.eventSubscriptions[eventConstructor.eventName].eventHandlers.push(handler);
		}
	}

	private async startLongPolling(): Promise<void> {
		let eventResponse: NaniumEventResponse;
		try {
			const subscription: EventSubscription = { clientId: this.id };
			for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
				const interceptor: EventSubscriptionSendInterceptor<any, any>
					= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
				await interceptor.execute(undefined, subscription);
			}
			const eventResponseString: string = await this.httpRequest('POST', this.config.apiEventUrl,
				await this.config.serializer.serialize(subscription));
			eventResponse = await this.config.serializer.deserialize(eventResponseString);
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
}
