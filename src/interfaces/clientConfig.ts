import ServiceRequestInterceptor from './serviceRequestInterceptor';
import ServiceResponseInterceptor from './serviceResponseInterceptor';

export default interface ClientConfig {
	apiUrl?: string;
	protocol?: 'http' | 'websocket';
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	responseInterceptors?: ServiceResponseInterceptor<any>[];
	exceptionHandler?: (response: any) => void;
}
