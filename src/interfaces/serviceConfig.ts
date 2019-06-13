export interface ServiceConfig {

	/**
	 * list of interceptor names that shall be skipped when this Service executes
	 */
	skipInterceptors?: boolean | string[] | {
		[scope: string]: boolean | string[];
	};

	/**
	 * list of scopes in which the service may be executed (e.g. 'public' or 'private')
	 */
	scopes?: string[];

	/**
	 * the inner Array is OR coupled, and the outer is AND coupled
	 */
	requiredRights?: string[][];
}
