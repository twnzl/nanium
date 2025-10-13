import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestGetBinaryRequest } from './getBinary.contract';

export class TestGetBinaryExecutor implements ServiceExecutor<TestGetBinaryRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';

	async execute(request: TestGetBinaryRequest, executionContext: TestExecutionContext): Promise<NaniumBuffer> {
		const result = new TextEncoder().encode('this is a text that will be send as binary data');
		return new NaniumBuffer(result.buffer);
	}
}
