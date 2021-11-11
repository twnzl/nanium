import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { KindOfResponsibility } from './kindOfResponsibility';
import { NaniumSerializer } from './serializer';

export interface ServiceConsumerConfig {
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	handleError?: (e: any) => Promise<void>;
	isResponsible: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
	serializer?: NaniumSerializer;
}
