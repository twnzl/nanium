import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { TestExecutionContext } from '../../services/testExecutionContext';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: TestExecutionContext): Promise<ServiceRequestBase<any, any>> {
		if (request.head) {
			if (request.head.token === '1234') {
				context.user = 'user 1234';
				context.tenant = 'Company1';
			} else if (request.head.token === '4321') {
				context.user = 'user 4321';
				context.tenant = 'Company1';
			} else if (request.head.token === '5678') {
				context.user = 'user 5678';
				context.tenant = 'Company2';
			} else {
				throw new Error('unauthorized');
			}
		} else {
			throw new Error('unauthorized');
		}

		return request;
	}

	constructor() {

	}
}
