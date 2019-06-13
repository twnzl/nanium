import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { ServiceRequestInterceptor } from '../../..';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, scope?: string): Promise<ServiceRequestBase<any, any>> {
		request.head = {
			token: '1234'
		};
		return request;
	}
}
