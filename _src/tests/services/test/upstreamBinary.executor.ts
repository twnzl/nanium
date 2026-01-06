import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestUpstreamBinaryRequest, TestUpstreamBinaryResponse } from './upstreamBinary.contract';

export class TestUpstreamBinaryExecutor implements ServiceExecutor<TestUpstreamBinaryRequest, TestUpstreamBinaryResponse> {
	static serviceName: string = 'NaniumTest:test/upstreamBinary';

	async execute(request: TestUpstreamBinaryRequest): Promise<TestUpstreamBinaryResponse> {
		const response = new TestUpstreamBinaryResponse({
			upstream1NumberOfReceivedBytes: 0,
			upstream2NumberOfReceivedBytes: 0,
		});
		const stream1 = request.body.upstream1;
		const stream2 = request.body.upstream2;
		const data1 = new NaniumBuffer();
		const data2 = new NaniumBuffer();
		const promises = [];

		if (stream1) {
			promises.push(
				(async () => {
					for await (const chunk of stream1) {
						data1.write(chunk);
					}
					response.upstream1NumberOfReceivedBytes = data1.length;
				})()
			);
		}
		if (stream2) {
			promises.push(
				(async () => {
					for await (const chunk of stream2) {
						data2.write(chunk);
					}
					response.upstream2NumberOfReceivedBytes = data2.length;
				})()
			);
		}

		await Promise.all(promises);
		return response;
	}
}

