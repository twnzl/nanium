import { Channel } from '../../interfaces/channel.js';
import { Message } from '../../interfaces/communicator.js';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor.js';
import { EventHandler } from '../../interfaces/eventHandler.js';
import { EventSubscription } from '../../interfaces/eventSubscription.js';
import { EventEmissionSendInterceptor, EventSubscriptionReceiveInterceptor } from '../../interfaces/eventSubscriptionInterceptor.js';
import { ExecutionContext } from '../../interfaces/executionContext.js';
import { ServiceExecutor } from '../../interfaces/serviceExecutor.js';
import { ServiceProviderConfig } from '../../interfaces/serviceProviderConfig.js';
import { ServiceProviderManager } from '../../interfaces/serviceProviderManager.js';
import { NaniumRepository } from '../../interfaces/serviceRepository.js';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor.js';
import { ConstructorType } from '../../objects.js';
export declare class NaniumNodejsProviderConfig implements ServiceProviderConfig {
    /**
     * root path where nanium should search for service executor implementations
     * if not given - no automatic registration of the services is done,
     * but it can be done manually by using ServiceProviderManager.addService().
     * This may be useful for unit tests to register MockImplementations for some services
     */
    servicePath?: string;
    /**
     * array of channels for incoming requests
     * !do not change this collection after the manager has been initialized (that means after calling Nanium.addManager())!
     */
    channels?: Channel[];
    /**
     * interceptors (code that runs before each request is executed)
     */
    requestInterceptors?: (ServiceRequestInterceptor<any> | (new () => ServiceRequestInterceptor<any>))[];
    /**
     * exception handling function
     */
    handleError?: (e: Error | any, serviceName: string, request: any, context?: ExecutionContext) => Promise<void>;
    /**
     * returns if the Manager is responsible for the given Service
     * 0 means not responsible and >0 means responsible, with the rule that the one with the highest number wins
     */
    isResponsible?: (request: any, serviceName: string) => Promise<number>;
    /**
     * returns if the Manager is responsible for the given eventName
     * manager with the highest values above 0 wins
     * @param eventName
     * @param context
     */
    isResponsibleForEvent?: (eventName: string, context?: any) => Promise<number>;
    /**
     * event subscription interceptors
     * code that runs if a subscription request has been received, to check acceptance
     * and add data to the subscription context
     */
    eventSubscriptionReceiveInterceptors?: (EventSubscriptionReceiveInterceptor<any> | (new () => EventSubscriptionReceiveInterceptor<any>))[];
    /**
     * event emission interceptors
     * code that runs if an event occurs, to check to which subscriber this event must be emitted
     */
    eventEmissionSendInterceptors?: (EventEmissionSendInterceptor<any> | (new () => EventEmissionSendInterceptor<any>))[];
}
export declare class NaniumProviderNodejs implements ServiceProviderManager {
    repository: NaniumRepository;
    eventSubscriptions: {
        [eventName: string]: EventSubscription[];
    };
    config: NaniumNodejsProviderConfig;
    constructor(config: NaniumNodejsProviderConfig);
    addService<T>(requestClass: new () => T, executorClass: new () => ServiceExecutor<T, any>): void;
    addChannel<T>(channel: Channel): void;
    getRequestClass(serviceName: string): ConstructorType;
    init(): Promise<void>;
    terminate(): Promise<void>;
    private static findClassWithServiceNameProperty;
    isResponsible(request: any, serviceName: string): Promise<number>;
    execute(serviceName: string, request: any, context?: ExecutionContext): Promise<any>;
    /**
     * execute request interceptors
     */
    private executeRequestInterceptors;
    emit(eventName: string, event: any, executionContext: ExecutionContext): Promise<void>;
    isResponsibleForEvent(eventName: string, context?: any): Promise<number>;
    subscribe(eventConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription>;
    unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void>;
    receiveSubscription(subscription: EventSubscription): Promise<void>;
    receiveCommunicatorMessage(msg: Message): void;
    removeClient(clientId: string): Promise<void>;
}
