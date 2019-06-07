import Nocat from '../../core';
import NocatServer from '../../managers/server';
import {TestRequest, TestResponseBody} from '../services/contracts/test.contract';
import {ServiceResponseBase} from '../../bases/response.base';
import TestServerRequestInterceptor from '../services/interceptors/server/test.request.interceptor';
import TestServerResponseInterceptor from '../services/interceptors/server/test.response.interceptor';

describe('execute TestRequest on server \n', function (): void {
	const request: TestRequest = new TestRequest({
		input1: 'hello world'
	});
	let response: ServiceResponseBase<TestResponseBody>;

	beforeEach(async function (): Promise<void> {
		await Nocat.init(new NocatServer({
			executorsPath: 'dist/tests/services/executors',
			requestInterceptors: [new TestServerRequestInterceptor()],
			responseInterceptors: [new TestServerResponseInterceptor()]
		}));
		response = await request.execute();
	});

	it('--> \n', async function (): Promise<void> {
		expect(response.body.output1).toBe('hello world :-)', 'output1 should be correct');
		expect(response.body.output2).toBe(2, 'output2 should be correct');
		expect(request.head.apiVersion).toBe('45', 'the apiVersion should have been set by the server interceptor');
		expect(response.head.apiLocation).toBe('localhost/api', 'the apiLocation should have been set by the server interceptor');
	});

});

