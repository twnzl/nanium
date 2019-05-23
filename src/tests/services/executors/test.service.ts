import TestRequest from '../contracts/test.request';
import ServiceExecutor from '../../../interfaces/serviceExecutor';

export default class TestExecutor implements ServiceExecutor {

	async execute(request: TestRequest, scope?: string): Promise<string> {
		return  request.input1 + ' :-)';
	}

}
