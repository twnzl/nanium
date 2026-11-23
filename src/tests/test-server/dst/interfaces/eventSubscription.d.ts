import { EventHandler } from './eventHandler.js';
export declare class EventSubscription<TData = any, TContext = any> {
    private static nextId;
    id: number;
    clientId: string;
    context: TContext;
    eventName: string;
    additionalData?: TData;
    channelId?: string;
    source?: string;
    handler?: EventHandler;
    constructor(clientId: string, eventName: string, handler?: EventHandler, additionalData?: TData);
    unsubscribe(): Promise<void>;
}
