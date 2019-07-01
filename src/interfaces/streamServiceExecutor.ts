import { ServiceConfig } from './serviceConfig';
import { Observable } from 'rxjs';

export interface StreamServiceExecutor<TRequest, TResponse> {
	stream(request: TRequest, scope?: string): Observable<TResponse>;

	config?: ServiceConfig;
}
