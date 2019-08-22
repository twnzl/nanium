import { ServiceExecutionScope } from './serviceRequest';

export interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest, scope?: ServiceExecutionScope,
	): Promise<TRequest>;
}
