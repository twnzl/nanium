import { ExecutionContext } from './executionContext';

export interface ServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, context?: ExecutionContext): Promise<TResponse>;
}
