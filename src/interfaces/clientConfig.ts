import { ServiceRequestInterceptor } from './serviceRequestInterceptor';

export interface ClientConfig {
	apiUrl?: string;
	protocol?: 'http' | 'websocket';
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	handleError?: (e: any) => Promise<void>;
}
