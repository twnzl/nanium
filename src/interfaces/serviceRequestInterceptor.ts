import { ServiceExecutionContext } from './ServiceExecutionContext';

export interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest, context: ServiceExecutionContext,
	): Promise<void>;
}
