import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestUpstreamObjectsRequest, TestUpstreamObjectsResponse } from './upstreamObjects.contract';

export class TestUpstreamObjectsExecutor implements ServiceExecutor<TestUpstreamObjectsRequest, TestUpstreamObjectsResponse> {
	static serviceName: string = 'NaniumTest:test/upstreamObjects';

	async execute(request: TestUpstreamObjectsRequest): Promise<TestUpstreamObjectsResponse> {
		const response = new TestUpstreamObjectsResponse({
			receivedObjects1: [],
			receivedObjects2: [],
		});
		const stream1 = request.body.upstream1;
		const stream2 = request.body.upstream2;
		const promises = [];

		if (stream1) {
			promises.push(
				(async () => {
					for await (const chunk of stream1) {
						response.receivedObjects1.push(chunk);
					}
				})()
			);
		}
		if (stream2) {
			promises.push(
				(async () => {
					for await (const chunk of stream2) {
						response.receivedObjects2.push(chunk);
					}
				})()
			);
		}

		await Promise.all(promises);
		return response;
	}
}

