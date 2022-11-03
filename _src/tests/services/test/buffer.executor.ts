import { TestBufferRequest, TestBufferResponse } from './buffer.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestBufferExecutor implements ServiceExecutor<TestBufferRequest, TestBufferResponse> {
	static serviceName: string = 'NaniumTest:test/buffer';

	async execute(request: TestBufferRequest, executionContext: ServiceRequestContext): Promise<TestBufferResponse> {
		request.body.buffer1?.write(new TextEncoder().encode('*'));
		request.body.buffer2?.write(new TextEncoder().encode('*'));
		return new TestBufferResponse({
			id: request.body.id,
			text1: await request.body.buffer1?.asString(),
			text2: await request.body.buffer2?.asString(),
			// buffer1: request.body.buffer1,
			// buffer2: request.body.buffer2,
		});
	}
}
