import { ServiceRequestInterceptor } from '../../../../interfaces/serviceRequestInterceptor';
import { ServiceRequestBase } from '../../contracts/serviceRequestBase';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, scope?: string): Promise<ServiceRequestBase<any, any>> {
		request.head = {
			token: '1234'
		};
		return request;
	}
}
