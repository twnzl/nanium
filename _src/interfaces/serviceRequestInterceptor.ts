import { ExecutionContext } from './executionContext.js';

export interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest,
		context: ExecutionContext,
	): Promise<TRequest>;
}
