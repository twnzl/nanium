import { EventSubscription } from '../../interfaces/eventSubscription';
import { EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { genericTypesSymbol, NaniumObject } from '../../objects';

export interface ConsumerEventSubscription {
	id: number;
	eventName: string;
	additionalData?: any;
	eventConstructor?: ((new(data?: any) => any) & { eventName: string });
	eventHandlers: Map<number, EventHandler>;
}

export class ConsumerBase<TConfig extends ServiceConsumerConfig> {
	config: TConfig;

	protected id: string = crypto.randomUUID();
	protected eventSubscriptions: { [eventName: string]: ConsumerEventSubscription } = {};

	constructor(config?: ServiceConsumerConfig) {
		this.config = {
			...{
				onServerConnectionRestored: () => {
				},
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					alert(response);
					return Promise.resolve();
				},
				isResponsible: async (): Promise<number> => Promise.resolve(0),
				isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
			},
			...(config || {})
		} as unknown as TConfig;
	}

	async subscribeLocal(
		eventNameOrConstructor: EventNameOrConstructor,
		handler: EventHandler
	): Promise<EventSubscription> {
		const eventName: string = typeof eventNameOrConstructor === 'string' ? eventNameOrConstructor : eventNameOrConstructor.eventName;
		const subscription: EventSubscription = new EventSubscription(this.id, eventName);
		// interceptors
		for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
			const interceptor: EventSubscriptionSendInterceptor<any, any>
				= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
			await interceptor.execute(eventNameOrConstructor, subscription);
		}
		// add subscription info
		if (!this.eventSubscriptions.hasOwnProperty(subscription.eventName)) {
			this.eventSubscriptions[subscription.eventName] = {
				id: subscription.id,
				eventName: subscription.eventName,
				eventConstructor: typeof eventNameOrConstructor === 'string' ? undefined : eventNameOrConstructor,
				eventHandlers: new Map<number, EventHandler>(),
				additionalData: subscription.additionalData,
			};
		}
		this.eventSubscriptions[eventName].eventHandlers.set(subscription.id, handler);
		return subscription;
	}

	async unsubscribeLocal(
		subscription: EventSubscription,
		eventName: string
	): Promise<void> {
		this.eventSubscriptions ??= {};
		eventName = subscription?.eventName ?? eventName;
		if (subscription) {
			this.eventSubscriptions[eventName]?.eventHandlers?.delete(subscription.id);
		}
		if (!subscription || !this.eventSubscriptions[eventName]?.eventHandlers?.size) {
			subscription = subscription ?? new EventSubscription(this.id, eventName);
			for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
				const interceptor: EventSubscriptionSendInterceptor<any, any>
					= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
				await interceptor.execute(this.eventSubscriptions[eventName].eventConstructor ?? eventName, subscription);
			}
			delete this.eventSubscriptions[eventName];
		}
	}

	async receiveEventLocal(eventName: string, event: any): Promise<void> {
		if (this.eventSubscriptions[eventName]) {
			const eventConstructor: any = this.eventSubscriptions[eventName].eventConstructor;
			if (eventConstructor) {
				// type-save deserialization
				event = NaniumObject.create(
					event,
					eventConstructor,
					eventConstructor[genericTypesSymbol]
				);
			}
			// call registered handlers
			if (event) {
				for (const handler of this.eventSubscriptions[eventName].eventHandlers.values()) {
					await handler(event);
				}
			}
		}
	}
}
