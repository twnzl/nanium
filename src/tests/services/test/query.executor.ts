import { TestQueryRequest, TestQueryResponse } from './query.contract';
import { ServiceExecutor } from '../../..';
import { ServiceResponseMessage } from '../serviceResponseBase';

export default class TestQueryExecutor implements ServiceExecutor<TestQueryRequest, TestQueryResponse> {
	static serviceName: string = 'TestQuery';

	async execute(request: TestQueryRequest): Promise<TestQueryResponse> {
		if (request.body.input2 === 5) {
			throw new Error('no!');
		}
		if (request.body.input2 === 4) {
			throw new ServiceResponseMessage('E2', 'Error 2');
		}
		if (request.body.input2 === 10) {
			throw new Error('no no!');
		}
		return new TestQueryResponse({
			output1: request.body.input1 + ' :-)',
			output2: 2
		});
	}

}

