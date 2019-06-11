export default interface ServiceRequest<TResponse> {
	execute(): Promise<TResponse>;
}
