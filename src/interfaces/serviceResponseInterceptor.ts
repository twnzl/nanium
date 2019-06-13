export interface ServiceResponseInterceptor<TResponse> {
	execute(response: TResponse): Promise<TResponse>;
}
