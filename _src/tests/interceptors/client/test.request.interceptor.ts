import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { TestExecutionContext } from '../../services/testExecutionContext';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor';
import { ServiceRequestHead } from '../../services/serviceRequestHead';
import { session } from '../../session';

export class TestClientRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
	async execute(request: ServiceRequestBase<any, any>, context: TestExecutionContext): Promise<ServiceRequestBase<any, any>> {
		request.head = request.head ?? new ServiceRequestHead({ token: session.token });
		return request;
	}
}
