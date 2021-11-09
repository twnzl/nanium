import { ServiceRequestContext } from './services/serviceRequestContext';
import * as http from 'http';
import { IncomingMessage } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { URL } from 'url';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestHelper } from './testHelper';

const request: TestGetRequest = new TestGetRequest({ input1: 'hello world' }, { token: '1234' });
const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });
let response: TestGetResponse;

describe('host services via http \n', function (): void {

	beforeAll(async () => {
		await TestHelper.initClientServerScenario('http');
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('execute request via the consumer\n', function (): void {
		beforeEach(async () => {
			request.body.input2 = null;
			response = await request.execute(executionContext);
		});

		it('--> the service should have been called via the http channel and should return the right result \n', async () => {
			expect(response.body.output1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'o2 should be correct').toBe(2);
		});
	});

	describe('call an url of the http server that is not managed by nocat \n', function (): void {
		let result: any;
		beforeEach(async () => {
			result = await new Promise<any>(resolve => {
				http.get('http://localhost:8888/stuff', (res: IncomingMessage) => {
					let str: string = '';
					res.on('data', (chunk: string) => {
						str += chunk;
					});
					res.on('end', async () => {
						resolve(str);
					});
				});
			});
		});

		it('--> the original request listener of the server should have handled the request \n', async () => {
			expect(result).toBe('*** http fallback ***');
		});
	});
});

describe('host services via https \n', function (): void {
	beforeAll(async () => {
		await TestHelper.initClientServerScenario('https');
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('execute request via the consumer\n', function (): void {
		beforeEach(async () => {
			request.body.input2 = null;
			response = await request.execute(executionContext);
		});

		it('--> the service should have been called via the http channel and should return the right result \n', async () => {
			expect(response.body.output1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'o2 should be correct').toBe(2);
		});
	});

	describe('call an url of the https server that is not managed by nocat \n', function (): void {
		let result: any;
		beforeEach(async () => {
			result = await new Promise<any>(resolve => {
				const uri: URL = new URL('https://localhost:9999/stuff');
				const options: HttpsRequestOptions = {
					host: uri.hostname,
					path: uri.pathname,
					port: uri.port,
					method: 'POST',
					protocol: uri.protocol,
					rejectUnauthorized: false
				};
				https.get(options, (res: IncomingMessage) => {
					let str: string = '';
					res.on('data', (chunk: string) => {
						str += chunk;
					});
					res.on('end', async () => {
						resolve(str);
					});
				});
			});
		});

		it('--> the original request listener of the server should have handled the request \n', async () => {
			expect(result).toBe('*** https fallback ***');
		});
	});
});
