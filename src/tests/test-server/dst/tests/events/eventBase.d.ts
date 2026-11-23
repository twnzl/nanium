import { EventHandler } from '../../interfaces/eventHandler.js';
import { EventSubscription } from '../../interfaces/eventSubscription.js';
import { ExecutionContext } from '../../interfaces/executionContext.js';
import { ServiceManager } from '../../interfaces/serviceManager.js';
import { ConstructorType, NaniumObject } from '../../objects.js';
export declare class EventBase<T = any> extends NaniumObject<T> {
    emit(this: T, context?: ExecutionContext): void;
    static subscribe<T extends EventBase<T>>(this: ConstructorType<T>, handler: EventHandler<T>, context?: ExecutionContext, manager?: ServiceManager): Promise<EventSubscription>;
    static unsubscribe(subscriptionOrManager?: EventSubscription | ServiceManager): Promise<void>;
}
export declare class TestSubscriptionData {
    token: string;
    tenant: string;
    constructor(token: string, tenant: string);
}
