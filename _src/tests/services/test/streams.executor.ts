import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestStreamsRequest, TestStreamsResponse } from './streams.contract';

export class TestStreamExecutor implements ServiceExecutor<TestStreamsRequest, TestStreamsResponse> {
	static serviceName: string = 'NaniumTest:test/streams';

	async execute(request: TestStreamsRequest, executionContext: TestExecutionContext): Promise<TestStreamsResponse> {
		const response = new TestStreamsResponse({
			id: request.body.id,
			stream1: new NaniumStream(),
			stream2: new NaniumStream(),
		});
		request.body.stream1?.onData((data: Uint8Array) => {
			response.stream1.write(data);
		});
		request.body.stream1?.onEnd(() => {
			response.stream1.write(new TextEncoder().encode('*'));
			response.stream1.end();
		});
		request.body.stream2?.onData((data: Uint8Array) => {
			response.stream2.write(data);
		});
		request.body.stream2?.onEnd(() => {
			response.stream2.write(new TextEncoder().encode('*'));
			response.stream2.end();
		});
		return response;
	}
}
