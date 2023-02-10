import { ExecutionContext } from './executionContext';
import { EventSubscription } from './eventSubscription';

export interface EventSubscriptionSendInterceptor<TEvent, TSubscriptionData> {
	execute(
		eventClass: new(data?: any) => TEvent, subscription: EventSubscription<TSubscriptionData>
	): Promise<void>;
}

export interface EventSubscriptionReceiveInterceptor<TEvent> {
	execute(data: EventSubscription): Promise<void>;
}

export interface EventEmissionSendInterceptor<TEvent> {
	execute(
		event: TEvent,
		context: ExecutionContext,
		subscription: EventSubscription
	): Promise<boolean>;
}
