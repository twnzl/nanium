import { Observable } from 'rxjs';

export interface ServiceManager {
	execute?(serviceName: string, request: any): Promise<any>;

	stream?(serviceName: string, request: any): Observable<any>;

	init(): Promise<void>;
}
