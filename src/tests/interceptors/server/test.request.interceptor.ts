import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { ServiceRequestInterceptor } from '../../..';
import { ServiceRequestContext } from '../../services/serviceRequestContext';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: ServiceRequestContext): Promise<void> {
		request.head = {
			token: '1234'
		};
	}
}
