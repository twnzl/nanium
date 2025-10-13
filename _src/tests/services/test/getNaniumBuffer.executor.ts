import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestGetNaniumBufferRequest } from './getNaniumBuffer.contract';

export class TestGetNaniumBufferExecutor implements ServiceExecutor<TestGetNaniumBufferRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getNaniumBuffer';

	async execute(request: TestGetNaniumBufferRequest, executionContext: TestExecutionContext): Promise<NaniumBuffer> {
		return await NaniumBuffer.create(new TextEncoder().encode('this is a text that will be send as NaniumBuffer'));
	}
}
