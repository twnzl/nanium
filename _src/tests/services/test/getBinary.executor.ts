import { TestGetBinaryRequest } from './getBinary.contract';
import { TestExecutionContext } from '../testExecutionContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestGetBinaryExecutor implements ServiceExecutor<TestGetBinaryRequest, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';

	async execute(request: TestGetBinaryRequest, executionContext: TestExecutionContext): Promise<ArrayBuffer> {
		const result = new TextEncoder().encode('this is a text that will be send as binary data');
		return result.buffer;
	}
}
