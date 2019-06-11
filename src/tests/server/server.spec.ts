import Nocat from '../../core';
import NocatServer from '../../managers/server';
import {TestRequest, TestResponse} from '../services/contracts/test.contract';
import TestServerRequestInterceptor from '../services/interceptors/server/test.request.interceptor';
import TestServerResponseInterceptor from '../services/interceptors/server/test.response.interceptor';

describe('execute TestRequest on server \n', function (): void {
	const request: TestRequest = new TestRequest('hello world');
	let response: TestResponse;

	beforeEach(async function (): Promise<void> {
		await Nocat.init(new NocatServer({
			executorsPath: 'dist/tests/services/executors',
			requestInterceptors: [new TestServerRequestInterceptor()],
			responseInterceptors: [new TestServerResponseInterceptor()]
		}));
		response = await request.execute();
	});

	it('--> \n', async function (): Promise<void> {
		expect(response.output1).toBe('hello world :-)', 'output1 should be correct');
		expect(response.output2).toBe(2, 'output2 should be correct');
		expect(request['v']).toBe(45, 'the property v should have been set by the server interceptor');
		expect(response['l']).toBe('L', 'the property l should have been set by the server interceptor');
	});

});

