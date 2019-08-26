import { ServiceConfig } from './serviceConfig';
import { ServiceExecutionContext } from './serviceExecutionContext';

export interface ServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, context?: ServiceExecutionContext): Promise<TResponse>;

	config?: ServiceConfig;
}
