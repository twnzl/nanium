export interface ServiceExecutionContext {
	scope?: ServiceExecutionScope
}

export enum ServiceExecutionScope {
	private = 'private',
	public = 'public',
}
