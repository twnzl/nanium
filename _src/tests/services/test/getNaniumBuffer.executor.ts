import { TestGetNaniumBufferRequest } from './getNaniumBuffer.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

export class TestGetNaniumBufferExecutor implements ServiceExecutor<TestGetNaniumBufferRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getNaniumBuffer';

	async execute(request: TestGetNaniumBufferRequest, executionContext: ServiceRequestContext): Promise<NaniumBuffer> {
		return new NaniumBuffer('this is a text that will be send as NaniumBuffer');
	}
}
