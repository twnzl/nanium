import { Nocat } from '../core';
import { NocatServer } from '../managers/server';
import { TestQueryRequest, TestQueryResponse } from './services/test/query.contract';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestServerResponseInterceptor } from './interceptors/server/test.response.interceptor';

describe('execute TestRequest on server \n', function (): void {
	const request: TestQueryRequest = new TestQueryRequest({ input1: 'hello world' });
	let response: TestQueryResponse;

	beforeEach(async function (): Promise<void> {
		await Nocat.init(new NocatServer({
			servicePath: 'dist/tests/services',
			requestInterceptors: [new TestServerRequestInterceptor()],
			responseInterceptors: [new TestServerResponseInterceptor()]
		}));
		response = await request.execute();
	});

	it('--> \n', async function (): Promise<void> {
		expect(response.body.output1).toBe('hello world :-)', 'output1 should be correct');
		expect(response.body.output2).toBe(2, 'output2 should be correct');
		expect(request.head.token).toBe('1234', 'the property head.token should have been set by the server request interceptor');
		expect(response.head['tmp']).toBe(':-)', 'the property head.tmp should have been set by the server response interceptor');
	});

});

