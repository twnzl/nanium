import { AsyncHelper } from '../../../helper';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestUpstreamBinaryRequest, TestUpstreamBinaryResponse } from './upstreamBinary.contract';

export class TestUpstreamBinaryExecutor implements ServiceExecutor<TestUpstreamBinaryRequest, TestUpstreamBinaryResponse> {
	static serviceName: string = 'NaniumTest:test/upstreamBinary';

	async execute(request: TestUpstreamBinaryRequest): Promise<TestUpstreamBinaryResponse> {
		if (request.body.doNotSendReadySignal) {
			await AsyncHelper.pause(2000); // default for tests is 1000
		}
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
				new Promise<void>((resolve: () => void, reject: (err: Error | unknown) => void) => {
					stream1.onData(chunk => {
						return Promise.resolve(data1.write(chunk));
					});
					stream1.onEnd(() => {
						response.upstream1NumberOfReceivedBytes = data1.length;
						resolve()
					});
					stream1.onError(e => {
						reject(e);
					});
				})
			);
			stream1.receiverReady();
		}
		if (stream2) {
			promises.push(
				new Promise<void>((resolve: () => void, reject: (err: Error | unknown) => void) => {
					stream2.onData(chunk => {
						return Promise.resolve(data2.write(chunk))
					});
					stream2.onEnd(() => {
						response.upstream2NumberOfReceivedBytes = data2.length;
						resolve()
					});
					stream2.onError(e => {
						response.upstream1NumberOfReceivedBytes = data2.length;
						reject(e);
					});
				})
			);
			stream2.receiverReady();
		}

		await Promise.all(promises);
		return response;
	}
}

