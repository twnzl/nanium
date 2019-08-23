import { ServiceRequestInterceptor } from './serviceRequestInterceptor';

export interface ServerConfig {
	/**
	 * root path where nocat should searches for service executor implementations (default: /service)
	 */
	servicePath: string;

	/**
	 * array of interceptors (code that runs bevor each request is executed)
	 */
	requestInterceptors?: ServiceRequestInterceptor<any>[];

	/**
	 * which log output should be made?
	 */
	logMode?: LogMode;

	/**
	 * exception handling function
	 */
	handleError: (e: Error | any) => Promise<void>;
}

export enum LogMode {
	error = 1,
	debug = 2,
	info = 3
}
