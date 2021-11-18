import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { KindOfResponsibility } from './kindOfResponsibility';
import { RequestChannel } from './requestChannel';
import { ServiceExecutionContext } from './serviceExecutionContext';

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
	requestChannels?: RequestChannel[];

	/**
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: (new() => ServiceRequestInterceptor<any>)[];

	/**
	 * exception handling function
	 */
	handleError?: (e: Error | any, serviceName: string, request: any, context?: ServiceExecutionContext) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 */
	isResponsible?: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
}
