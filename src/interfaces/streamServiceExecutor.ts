import { Observable } from 'rxjs';
import { ServiceExecutionContext } from './serviceExecutionContext';

export interface StreamServiceExecutor<TRequest, TResponse> {
	stream(request: TRequest, context?: ServiceExecutionContext): Observable<TResponse>;
}
