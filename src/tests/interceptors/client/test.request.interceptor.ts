import { ServiceRequestBase } from '../../services/serviceRequestBase.js';
import { TestExecutionContext } from '../../services/testExecutionContext.js';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor.js';
import { ServiceRequestHead } from '../../services/serviceRequestHead.js';
import { session } from '../../session.js';

export class TestClientRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: TestExecutionContext): Promise<ServiceRequestBase<any, any>> {
		request.head = request.head ?? new ServiceRequestHead({ token: session.token });
		return request;
	}
}
