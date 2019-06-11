export default interface ServiceRequestInterceptor<TRequest> {
	execute(
		request: TRequest, scope?: string
	): Promise<TRequest>;
}
