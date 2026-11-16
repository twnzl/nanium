import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { TestExecutionContext } from '../testExecutionContext.js';
import { TestGetNaniumBufferRequest } from './getNaniumBuffer.contract.js';

export class TestGetNaniumBufferExecutor implements ServiceExecutor<TestGetNaniumBufferRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getNaniumBuffer';

	async execute(request: TestGetNaniumBufferRequest, executionContext: TestExecutionContext): Promise<NaniumBuffer> {
		return new NaniumBuffer().writeString('this is a text that will be send as NaniumBuffer');
	}
}
