export interface ServiceRequest<TResponse> {
	execute(): Promise<TResponse>;
}
