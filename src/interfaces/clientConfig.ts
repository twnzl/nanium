import { ServiceRequestInterceptor } from './serviceRequestInterceptor';

export interface ClientConfig {
	apiUrl?: string;
	protocol?: 'http' | 'websocket';
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	handleException?: (response: any) => void;
}
