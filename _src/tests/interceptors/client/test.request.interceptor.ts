import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { ServiceRequestContext } from '../../services/serviceRequestContext';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor';

export class TestClientRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
		request.head = request.head ?? { token: '1234' };
		return request;
	}
}
