import { TestGetNaniumBufferRequest } from './getNaniumBuffer.contract';
import { TestExecutionContext } from '../testExecutionContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

export class TestGetNaniumBufferExecutor implements ServiceExecutor<TestGetNaniumBufferRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getNaniumBuffer';

	async execute(request: TestGetNaniumBufferRequest, executionContext: TestExecutionContext): Promise<NaniumBuffer> {
		return new NaniumBuffer(new TextEncoder().encode('this is a text that will be send as NaniumBuffer'));
	}
}
