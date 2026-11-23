import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { TestExecutionContext } from '../testExecutionContext.js';
import { TestNoIORequest } from './noIO.contract.js';

export class TestNoIOExecutor implements ServiceExecutor<TestNoIORequest, void> {
	static serviceName: string = 'NaniumTest:test/noIO';

	async execute(_request: TestNoIORequest, _executionContext: TestExecutionContext): Promise<void> {
		return Promise.resolve();
	}
}
