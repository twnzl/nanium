import ServiceRequestInterceptor from './serviceRequestInterceptor';
import ServiceResponseInterceptor from './serviceResponseInterceptor';

export default interface ClientConfig {
	apiUrl?: string;
	protocol?: 'http' | 'websocket';
	requestInterceptors?: ServiceRequestInterceptor[];
	responseInterceptors?: ServiceResponseInterceptor[];
	exceptionHandler?: (response: any) => void;
}
