import { ServiceResponseMessage } from '../serviceResponseBase';
import { TestGetRequest, TestGetResponse } from './get.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class TestGetExecutor implements ServiceExecutor<TestGetRequest, TestGetResponse> {
	static serviceName: string = 'NaniumTest:test/get';

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

