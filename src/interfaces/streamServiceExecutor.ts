import { ServiceConfig } from './serviceConfig';
import { Observable } from 'rxjs';
import { ServiceExecutionContext } from './ServiceExecutionContext';

export interface StreamServiceExecutor<TRequest, TResponse> {
	stream(request: TRequest, context?: ServiceExecutionContext): Observable<TResponse>;

	config?: ServiceConfig;
}
