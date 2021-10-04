import { Observable } from 'rxjs';
import { ServiceExecutionContext } from './serviceExecutionContext';
import { KindOfResponsibility } from './kindOfResponsibility';
import { ServiceRequest } from './serviceRequest';
import { StreamServiceRequest } from './streamServiceRequest';

export interface ServiceManager {
	execute?(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any>;

	stream?(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any>;

	/**
	 * must return true if the Service implements the stream method to stream the partial Results via an Observable
	 * @param serviceName
	 */
	isStream?(serviceName: string): boolean;

	/**
	 * must return 'yes' if this manager is responsible for requests with the given name
	 * @param request
	 * @param serviceName
	 */
	isResponsible(request: ServiceRequest<any> | StreamServiceRequest<any>, serviceName: string): KindOfResponsibility;

	/**
	 * initialize the manager.
	 * Nocat will call this when the manager (provider or consumer) is added to the nocat service managers via Nocat.addManager
	 */
	init(): Promise<void>;
}
