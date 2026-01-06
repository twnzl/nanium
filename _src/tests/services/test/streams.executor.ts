import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestStreamsRequest, TestStreamsResponse } from './streams.contract';

export class TestStreamExecutor implements ServiceExecutor<TestStreamsRequest, TestStreamsResponse> {
	static serviceName: string = 'NaniumTest:test/streams';

	async execute(request: TestStreamsRequest, _executionContext: TestExecutionContext): Promise<TestStreamsResponse> {
		const response = new TestStreamsResponse({
			id: request.body.id,
			stream1: new NaniumStream(),
			stream2: new NaniumStream(),
		});

		void (async () => {
			for await (const data of request.body.stream1) {
				response.stream1.write(data);
			}
			response.stream1.write(new TextEncoder().encode('*'));
			response.stream1.end();
		})();

		void (async () => {
			for await (const data of request.body.stream2) {
				response.stream2.write(data);
			}
			response.stream2.write(new TextEncoder().encode('*'));
			response.stream2.end();
		})();

		return Promise.resolve(response);
	}
}
