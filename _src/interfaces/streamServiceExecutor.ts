import { Observable } from 'rxjs';
import { ExecutionContext } from './executionContext';

/**
 * @deprecate: since version 19.0.0 streaming in both directions is done by properties of type NaniumStream
 * in requests and responses. StreamServiceExecutor will be removed soon.
 */
export interface StreamServiceExecutor<TRequest, TResponse> {

	/**
	 * @deprecate: since version 19.0.0 streaming in both directions is done by properties of type NaniumStream
	 * in requests and responses. StreamServiceExecutor will be removed soon.
	 */
	stream(request: TRequest, context?: ExecutionContext): Observable<TResponse>;
}
