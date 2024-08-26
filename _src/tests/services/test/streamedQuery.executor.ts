import { TestDto } from './contractparts';
import { TestStreamedQueryRequest } from './streamedQuery.contract';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestStreamedQueryExecutor implements ServiceExecutor<TestStreamedQueryRequest, NaniumStream<TestDto>> {
	static serviceName: string = 'NaniumTest:test/streamedQuery';

	async execute(request: TestStreamedQueryRequest): Promise<NaniumStream<TestDto>> {
		const result = new NaniumStream<TestDto>(TestDto);
		let cnt: number = 1;
		const next = () => {
			if (cnt > request.body.amount ?? 3) {
				result.end();
				clearInterval(interval);
			} else {
				result.write([new TestDto(cnt.toString(), cnt++), new TestDto(cnt.toString(), cnt++)]);
			}
		};
		// next();
		const interval = setInterval(() => next(), request.body.msGapTime ?? 1);

		return result;
	}


}

