import { Observable } from 'rxjs';
import { ExecutionContext } from './executionContext';

export interface StreamServiceExecutor<TRequest, TResponse> {
	stream(request: TRequest, context?: ExecutionContext): Observable<TResponse>;
}
