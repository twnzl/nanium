import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { KindOfResponsibility } from './kindOfResponsibility';
import { NaniumSerializer } from './serializer';

export interface ServiceConsumerConfig {
	requestInterceptors?: {
		[name: string]: new() => ServiceRequestInterceptor<any>
	};
	handleError?: (e: any) => Promise<void>;
	isResponsible?: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
	serializer?: NaniumSerializer;
}
