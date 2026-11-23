import { ExecutionContext } from './executionContext.js';
export interface ServiceExecutor<TRequest, TResponse> {
    execute(request: TRequest, context?: ExecutionContext): Promise<TResponse>;
}
