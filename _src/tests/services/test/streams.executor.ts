import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { TestDto } from './contractparts';
import { TestStreamsRequest, TestStreamsResponse } from './streams.contract';

export class TestStreamExecutor implements ServiceExecutor<TestStreamsRequest, TestStreamsResponse> {
	static serviceName: string = 'NaniumTest:test/streams';

	async execute(request: TestStreamsRequest, _executionContext: TestExecutionContext): Promise<TestStreamsResponse> {
		const response = new TestStreamsResponse({
			id: request.body.id,
			stream1: new NaniumStream(),
			stream2: new NaniumStream<TestDto>(),
		});

		void (async () => {
			try {
				for await (const chunk of request.body.stream1) {
					const text: string = await chunk.asString();
					console.log(text);
					response.stream1.write(chunk);
				}
				response.stream1.write(new NaniumBuffer(new TextEncoder().encode('*')));
				response.stream1.end();
			} catch (e) {
				console.log(e);
			}
		})();

		void (async () => {
			try {

				for await (const dto of request.body.stream2) {
					dto.a += '*';
					response.stream2.write(dto);
				}
				response.stream2.end();
			} catch (e) {
				console.log(e);
			}
		})();

		return Promise.resolve(response);
	}
}
