import { TestStreamedBinaryRequest } from './streamedBinary.contract';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

export class TestStreamedBinaryExecutor implements ServiceExecutor<TestStreamedBinaryRequest, NaniumStream<NaniumBuffer>> {
	static serviceName: string = 'NaniumTest:test/streamedBinary';

	async execute(request: TestStreamedBinaryRequest): Promise<NaniumStream<NaniumBuffer>> {
		const result = new NaniumStream<NaniumBuffer>();
		let cnt: number = 1;
		const next = () => {
			if (cnt > request.body.amount ?? 3) {
				result.end();
				clearInterval(interval);
			} else {
				result.write(new TextEncoder().encode(cnt.toString() + '.'));
				cnt++;
			}
		};
		// next();
		const interval = setInterval(() => next(), request.body.msGapTime ?? 1);
		return result;
	}
}

