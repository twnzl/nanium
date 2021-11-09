import { ServiceExecutionContext } from './serviceExecutionContext';

export interface ServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, context?: ServiceExecutionContext): Promise<TResponse>;
}
