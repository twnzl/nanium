import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { ServiceRequestContext } from '../../services/serviceRequestContext';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
		if (!request.head || request.head.token !== '1234') {
			throw new Error('unauthorized');
		}
		return request;
	}

	constructor() {

	}
}
