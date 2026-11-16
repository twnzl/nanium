import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { TestExecutionContext } from '../testExecutionContext.js';
import { TestGetBinaryRequest } from './getBinary.contract.js';

export class TestGetBinaryExecutor implements ServiceExecutor<TestGetBinaryRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';

	async execute(request: TestGetBinaryRequest, executionContext: TestExecutionContext): Promise<NaniumBuffer> {
		const result = new TextEncoder().encode('this is a text that will be send as binary data');
		return new NaniumBuffer(result.buffer);
	}
}
