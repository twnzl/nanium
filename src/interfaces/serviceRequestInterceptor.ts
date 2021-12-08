import { ExecutionContext } from './executionContext';

export interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest, context: ExecutionContext,
	): Promise<TRequest>;
}
