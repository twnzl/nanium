import { ExecutionContext } from './executionContext.js';
import { EventSubscription } from './eventSubscription.js';
import { EventNameOrConstructor } from './eventConstructor.js';

export interface EventSubscriptionSendInterceptor<TEvent, TSubscriptionData> {
	execute(
		eventNameOrConstructor: EventNameOrConstructor,
		subscription: EventSubscription<TSubscriptionData>
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
