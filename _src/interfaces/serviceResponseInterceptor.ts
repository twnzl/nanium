export interface ServiceResponseInterceptor<TRequest, TResponse> {
	execute(
		request: TRequest,
		response: TResponse
	): Promise<TResponse>;
}
