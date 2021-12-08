import { ExecutionContext } from './executionContext';

export interface EventSubscription<TData = any> {
	clientId: string;
	eventName?: string;
	additionalData?: TData;
}

export interface EventSubscriptionSendInterceptor<TEvent, TSubscriptionData> {
	execute(
		eventClass: new(data?: any) => TEvent, data: EventSubscription<TSubscriptionData>
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

// export interface EventEmissionReceiveInterceptor<TEvent> {
// 	execute(
// 		eventClass: new(data?: any) => TEvent, data: EventSubscriptionInfo, context: ExecutionContext
// 	): Promise<void>;
// }
