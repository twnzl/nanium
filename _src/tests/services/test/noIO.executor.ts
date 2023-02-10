import { TestNoIORequest } from './noIO.contract';
import { TestExecutionContext } from '../testExecutionContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestNoIOExecutor implements ServiceExecutor<TestNoIORequest, void> {
	static serviceName: string = 'NaniumTest:test/noIO';

	async execute(request: TestNoIORequest, executionContext: TestExecutionContext): Promise<void> {
		return;
	}
}
