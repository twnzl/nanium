import { Observable } from 'rxjs';
import { ServiceExecutionContext } from './serviceExecutionContext';
import { KindOfResponsibility } from './kindOfResponsibility';

export interface ServiceManager {
	execute?(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any>;

	stream?(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any>;

	/**
	 * must return 'yes' if this manager is responsible for requests with the given name
	 * @param request
	 * @param serviceName
	 */
	isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility>;

	/**
	 * initialize the manager.
	 * Nanium will call this when the manager (provider or consumer) is added to the nanium service managers via Nanium.addManager
	 */
	init(): Promise<void>;
}
