import { ExecutionContext } from './executionContext';
import { EventSubscription } from './eventSubscription';

export interface NaniumCommunicator {
	broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void>;

	broadcastSubscription(subscription: EventSubscription): Promise<void>;

	broadcastUnsubscription(subscription: EventSubscription): Promise<void>;
}
