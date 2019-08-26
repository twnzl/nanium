import { ServiceExecutionContext } from './serviceExecutionContext';

export interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest, context: ServiceExecutionContext,
	): Promise<void>;
}
