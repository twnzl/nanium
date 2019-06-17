import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { ServiceResponseInterceptor } from './serviceResponseInterceptor';

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
	 * array of interceptors (code that runs bevor each response is returned)
	 */
	responseInterceptors?: ServiceResponseInterceptor<any>[];

	/**
	 * which log output should be made?
	 */
	logMode?: LogMode;

	/**
	 * error handling function, if error could be handle a default response should be returned,
	 * which will be forwared as response of the execute function.
	 * If null or undefined is returned the Error will be thrown again (rejection of the Promise)
	 * @param err an exception or other kind of error Information thrown by the service executor
	 */
	handleError: (err: Error | any) => Promise<any>;
}

export enum LogMode {
	error = 1,
	debug = 2,
	info = 3
}
