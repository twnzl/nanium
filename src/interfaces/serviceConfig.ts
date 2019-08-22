export class ServiceConfig {
	/**
	 * list of interceptor names that shall be skipped when this Service executes
	 */
	skipInterceptors?: boolean | string[] | {
		[scope: string]: boolean | string[];
	};
}
