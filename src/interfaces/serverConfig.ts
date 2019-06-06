import ServiceRequestInterceptor from './serviceRequestInterceptor';
import ServiceResponseInterceptor from './serviceResponseInterceptor';

export default interface ServerConfig {
	executorsPath: string;
	requestInterceptors?: ServiceRequestInterceptor[];
	responseInterceptors?: ServiceResponseInterceptor[];
	exceptionHandler?: (response: any) => void;
}
