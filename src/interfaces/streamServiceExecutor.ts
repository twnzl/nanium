import { ServiceConfig } from './serviceConfig';
import { Observable } from 'rxjs';

export interface StreamServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, scope?: string): Observable<TResponse>;

	config?: ServiceConfig;
}
