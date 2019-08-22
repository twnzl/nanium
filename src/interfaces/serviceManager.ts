import { Observable } from 'rxjs';
import { ServiceExecutionScope } from './serviceRequest';

export interface ServiceManager {
	execute?(serviceName: string, request: any, scope?: ServiceExecutionScope): Promise<any>;

	stream?(serviceName: string, request: any, scope?: ServiceExecutionScope): Observable<any>;

	isStream?(serviceName: string): boolean;

	init(): Promise<void>;
}
