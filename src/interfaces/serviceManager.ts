import { Observable } from 'rxjs';
import { ServiceExecutionContext } from './serviceExecutionContext';

export interface ServiceManager {
	execute?(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any>;

	stream?(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any>;

	isStream?(serviceName: string): boolean;

	init(): Promise<void>;
}
