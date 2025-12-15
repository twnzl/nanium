import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TestStreamedBinaryRequest } from './streamedBinary.contract';

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
				void result.write(new TextEncoder().encode(cnt.toString() + '.'));
				cnt++;
			}
		};
		const interval = setInterval(() => next(), request.body.msGapTime ?? 1);
		return Promise.resolve(result);
	}
}

