import ServiceExecutor from '../../../interfaces/serviceExecutor';
import {TestRequest, TestResponse} from '../contracts/test.contract';

export default class TestExecutor implements ServiceExecutor<TestRequest, TestResponse> {
	async execute(request: TestRequest, scope?: string): Promise<TestResponse> {
		return new TestResponse({
			output1: request.body.input1 + ' :-)',
			output2: 2
		});
	}
}
