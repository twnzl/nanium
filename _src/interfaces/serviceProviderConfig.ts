import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { Channel } from './channel';
import { ExecutionContext } from './executionContext';
import { EventEmissionSendInterceptor, EventSubscriptionReceiveInterceptor } from './eventSubscriptionInterceptor';

export interface ServiceProviderConfig {
	/**
	 * root path where nanium should search for service executor implementations
	 * if not given - no automatic registration of the services is done,
	 * but it can be done manually by using ServiceProviderManager.addService().
	 * This may be useful for unit tests to register MockImplementations for some services
	 */
	servicePath?: string;

	/**
	 * array of channels through which request can be transmitted to the provider
	 */
	channels?: Channel[];

	/**
	 * request receive interceptors
	 * code that runs if a request has been received, and before it is executed.
	 * can execute (finish) the request just before the special request executor will run
	 */
	requestInterceptors?: (ServiceRequestInterceptor<any> | (new() => ServiceRequestInterceptor<any>))[];

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
	 * event subscription interceptors
	 * code that runs if a subscription request has been received, to check acceptance
	 * and add data to the subscription context
	 */
	eventSubscriptionReceiveInterceptors?: (EventSubscriptionReceiveInterceptor<any> | (new() => EventSubscriptionReceiveInterceptor<any>))[];

	/**
	 * event emission interceptors
	 * code that runs if an event occurs, to check to which subscriber this event must be emitted
	 */
	eventEmissionSendInterceptors?: (EventEmissionSendInterceptor<any> | (new() => EventEmissionSendInterceptor<any>))[];
}
