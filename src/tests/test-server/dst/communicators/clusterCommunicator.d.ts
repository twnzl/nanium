import { NaniumCommunicator } from '../interfaces/communicator.js';
import { EventSubscription } from '../interfaces/eventSubscription.js';
import { ExecutionContext } from '../interfaces/executionContext.js';
export declare class ClusterCommunicator<TExecutionContext extends ExecutionContext> implements NaniumCommunicator {
    private toTransferableContext;
    private fromTransferableContext;
    private primaryMessageListenerInstalled;
    constructor(toTransferableContext: (context: TExecutionContext) => any, fromTransferableContext: (data: any) => TExecutionContext);
    private primaryMessageListener;
    broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void>;
    broadcastSubscription(subscription: EventSubscription): Promise<void>;
    broadcastUnsubscription(subscription: EventSubscription): Promise<void>;
    broadcastRemoveClient(clientId: string): Promise<void>;
    broadcast(message: any): Promise<void>;
}
