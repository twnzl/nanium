import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { ServiceResponseInterceptor } from './serviceResponseInterceptor';

export interface ServerConfig {
	/**
	 * root path where nocat should search for executer implementations (defualt: /service/executors)
	 */
	executorsPath: string;
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	responseInterceptors?: ServiceResponseInterceptor<any>[];
	exceptionHandler?: (response: any) => void;
	logMode?: LogMode;
}

export enum LogMode {
	error = 1,
	debug = 2,
	info = 3
}
