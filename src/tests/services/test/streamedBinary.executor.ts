import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { TestStreamedBinaryRequest } from './streamedBinary.contract.js';

export class TestStreamedBinaryExecutor implements ServiceExecutor<TestStreamedBinaryRequest, NaniumStream<NaniumBuffer>> {
	static serviceName: string = 'NaniumTest:test/streamedBinary';

	async execute(request: TestStreamedBinaryRequest): Promise<NaniumStream<NaniumBuffer>> {
		const result = new NaniumStream<NaniumBuffer>();
		let cnt: number = 1;
		const next = () => {
			if (cnt > (request.body.amount ?? 3)) {
				result.end();
				clearInterval(interval);
			} else {
				void result.write(new NaniumBuffer(new TextEncoder().encode(cnt.toString() + '.')));
				cnt++;
			}
		};
		const interval = setInterval(() => next(), request.body.msGapTime ?? 1);
		return Promise.resolve(result);
	}
}

