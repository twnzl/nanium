import ServiceConfig from './serviceConfig';

export default interface ServiceExecutor<TRequest, TResponse> {
	execute(request: TRequest, scope?: string): Promise<TResponse>;

	config?: ServiceConfig;
}
