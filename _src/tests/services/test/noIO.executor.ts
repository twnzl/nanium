import { TestNoIORequest } from './noIO.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestNoIOExecutor implements ServiceExecutor<TestNoIORequest, void> {
	static serviceName: string = 'NaniumTest:test/noIO';

	async execute(request: TestNoIORequest, executionContext: ServiceRequestContext): Promise<void> {
		return;
	}
}
