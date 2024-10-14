import { ExecutionContext } from './executionContext';
import { EventSubscription } from './eventSubscription';

export interface NaniumCommunicator {
	broadcast(message: any): Promise<void>;

	broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void>;

	broadcastSubscription(subscription: EventSubscription): Promise<void>;

	broadcastUnsubscription(subscription: EventSubscription): Promise<void>;

	broadcastRemoveClient(clientId: string): Promise<void>;
}

type MessageType = 'event_emit' | 'event_subscribe' | 'event_unsubscribe' | 'generic' | 'remove_client';

export class Message<T = any> {
	constructor(
		public type: MessageType,
		public data: T,
		public from?: string | number
	) {
	}
}

export class EmitEventMessage {
	event: any;
	eventName: string;
	context?: ExecutionContext;
}
