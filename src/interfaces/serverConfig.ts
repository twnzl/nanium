import ServiceRequestInterceptor from './serviceRequestInterceptor';
import ServiceResponseInterceptor from './serviceResponseInterceptor';

export default interface ServerConfig {
	/**
	 * root path where nocat should search for executer implementations (defualt: /service/executors)
	 */
	executorsPath: string;
	requestInterceptors?: ServiceRequestInterceptor[];
	responseInterceptors?: ServiceResponseInterceptor[];
	exceptionHandler?: (response: any) => void;
}
