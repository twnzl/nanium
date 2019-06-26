import { TestGetRequest, TestGetResponse } from './get.contract';
import { ServiceExecutor } from '../../..';
import { ServiceResponseMessage } from '../serviceResponseBase';

export default class TestGetExecutor implements ServiceExecutor<TestGetRequest, TestGetResponse> {
	static serviceName: string = 'TestGet';

	async execute(request: TestGetRequest): Promise<TestGetResponse> {
		if (request.body.input2 === 5) {
			throw new Error('no!');
		}
		if (request.body.input2 === 4) {
			throw new ServiceResponseMessage('E2', 'Error 2');
		}
		if (request.body.input2 === 10) {
			throw new Error('no no!');
		}
		return new TestGetResponse({
			output1: request.body.input1 + ' :-)',
			output2: 2
		});
	}

}

