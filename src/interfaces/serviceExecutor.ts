import { ServiceConfig } from './serviceConfig';

export interface ServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, scope?: string): Promise<TResponse>;
	
	config?: ServiceConfig;
}
