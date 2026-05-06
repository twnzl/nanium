import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestNoIORequest } from './noIO.contract';

export class TestNoIOExecutor implements ServiceExecutor<TestNoIORequest, void> {
	static serviceName: string = 'NaniumTest:test/noIO';

	async execute(_request: TestNoIORequest, _executionContext: TestExecutionContext): Promise<void> {
		return Promise.resolve();
	}
}
