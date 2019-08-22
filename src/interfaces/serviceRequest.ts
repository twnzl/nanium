export interface ServiceRequest<TResponse> {
	execute(): Promise<TResponse>;
}

export enum ServiceExecutionScope {
	private = 'private',
	public = 'public',
}
