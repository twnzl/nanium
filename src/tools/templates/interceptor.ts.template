import { ServiceRequestInterceptor } from 'nanium/interfaces/serviceRequestInterceptor';
import { ServiceRequestBase } from './serviceRequestBase';
import { ServiceRequestContext } from './serviceRequestContext';

export class RequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {

	async execute(request: ServiceRequestBase<any, any>, executionContext: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
		// todo: check authorization, or do what ever you want to do with each incoming request before it will be executed
		return request;
	}
}
