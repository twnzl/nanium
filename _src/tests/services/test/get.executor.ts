import { ServiceResponseMessage } from '../serviceResponseBase.js';
import { TestGetRequest, TestGetResponse } from './get.contract.js';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { StuffEvent } from '../../events/test/stuffEvent.js';
import { TestExecutionContext } from '../testExecutionContext.js';
import { Stuff2Event } from '../../events/test/stuff2Event.js';

export class TestGetExecutor implements ServiceExecutor<TestGetRequest, TestGetResponse> {
	static serviceName: string = 'NaniumTest:test/get';

	async execute(request: TestGetRequest, executionContext: TestExecutionContext): Promise<TestGetResponse> {
		if (request.body.input2 === 5) {
			throw new Error('no!');
		}
		if (request.body.input2 === 4) {
			throw new ServiceResponseMessage('E2', 'Error 2');
		}
		if (request.body.input2 === 10) {
			throw new Error('no no!');
		}
		new StuffEvent(request.body.cnt ?? 9, '10', new Date(2011, 11, 11)).emit(executionContext);
		new Stuff2Event().emit(executionContext);
		return new TestGetResponse({
			output1: request.body.input1 + ' :-)',
			output2: 2,
		});
	}
}


