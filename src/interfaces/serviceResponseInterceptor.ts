export default interface ServiceResponseInterceptor<TResponse> {
	execute(response: TResponse): Promise<TResponse>;
}
