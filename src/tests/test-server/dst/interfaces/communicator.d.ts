import { ExecutionContext } from './executionContext.js';
import { EventSubscription } from './eventSubscription.js';
export interface NaniumCommunicator {
    broadcast(message: any): Promise<void>;
    broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void>;
    broadcastSubscription(subscription: EventSubscription): Promise<void>;
    broadcastUnsubscription(subscription: EventSubscription): Promise<void>;
    broadcastRemoveClient(clientId: string): Promise<void>;
}
type MessageType = 'event_emit' | 'event_subscribe' | 'event_unsubscribe' | 'generic' | 'remove_client';
export declare class Message<T = any> {
    type: MessageType;
    data: T;
    from?: string | number;
    constructor(type: MessageType, data: T, from?: string | number);
}
export declare class EmitEventMessage {
    event: any;
    eventName: string;
    context?: ExecutionContext;
}
export {};
