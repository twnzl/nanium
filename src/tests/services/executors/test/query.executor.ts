import { TestQueryRequest, TestQueryResponse } from '../../contracts/test/query.contract';
import { ServiceExecutor } from '../../../..';

export default class TestQueryExecutor implements ServiceExecutor<TestQueryRequest, TestQueryResponse> {
	static serviceName: string = 'TestQuery';

	async execute(request: TestQueryRequest): Promise<TestQueryResponse> {
		return new TestQueryResponse({
			output1: request.body.input1 + ' :-)',
			output2: 2
		});
	}

}

