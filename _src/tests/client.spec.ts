import { ServiceRequestContext } from './services/serviceRequestContext';
import * as http from 'http';
import { IncomingMessage } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { URL } from 'url';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestHelper } from './testHelper';
import { AnonymousRequest } from './services/test/anonymous.contract';
import { TimeRequest } from './services/test/time.contract';
import { TestNoIORequest } from './services/test/noIO.contract';

const request: TestGetRequest = new TestGetRequest({ input1: 'hello world' });
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
		describe('just execute \n', function (): void {
			it('--> the service should have been called via the http channel and should return the right result \n', async () => {
				request.body.input2 = null;
				response = await request.execute(executionContext);
				expect(response.output1, 'o1 should be correct').toBe('hello world :-)');
				expect(response.output2, 'o2 should be correct').toBe(2);
			});
		});

		describe('execute and skip interceptor \n', function (): void {
			let anonymousRequest: AnonymousRequest;
			let anonymousResponse: string;

			beforeEach(() => {
				anonymousRequest = new AnonymousRequest(undefined, {});
			});

			it('--> \n', async function (): Promise<void> {
				anonymousResponse = await anonymousRequest.execute(executionContext);
				expect(anonymousResponse, 'output should be correct').toBe(':-)');
			});
		});

		describe('execute with error result (handling by errorHandle) \n', function (): void {
			it('--> the errorHandler function should have handled the error \n', async () => {
				try {
					await new TestGetRequest({ input1: 'hello world' }, { token: 'wrong' }).execute(executionContext);
					expect(false, 'an exception should be thrown').toBeTruthy();
				} catch (e) {
					expect(e.handleError).toBeDefined();
					expect(e.handleError.message).toBe('unauthorized');
				}
			});
		});

		describe('execute with connection error \n', function (): void {
			it('--> execute should immediately return with exception \n', async () => {
				const apiUrl: string = TestHelper.consumer.config.apiUrl;
				try {
					TestHelper.consumer.config.apiUrl = 'https:/not.available/api';
					await new TestGetRequest({ input1: 'hello world' }).execute(executionContext);
					expect(false, 'an exception should be thrown').toBeTruthy();
				} catch (e) {
					expect((e.message as string).includes('ENOTFOUND')).toBeTruthy();
				} finally {
					TestHelper.hasServerBeenCalled = false;
					TestHelper.consumer.config.apiUrl = apiUrl;
				}
			});
		});

		describe('execute service with void body and void response \n', function (): void {
			it('--> should without exception \n', async () => {
				await new TestNoIORequest().execute(executionContext);
			});
		});
	});

	describe('call an url of the http server that is not managed by nanium \n', function (): void {
		let result: any;

		it('--> the original request listener of the server should have handled the request \n', async () => {
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
		it('--> the service should have been called via the http channel and should return the right result \n', async () => {
			request.body.input2 = null;
			response = await request.execute(executionContext);
			expect(response.output1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.output2, 'o2 should be correct').toBe(2);
		});
	});

	describe('call an url of the https server that is not managed by nanium \n', function (): void {

		it('--> the original request listener of the server should have handled the request \n', async () => {
			const result: any = await new Promise<any>(resolve => {
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
			expect(result).toBe('*** https fallback ***');
		});
	});

	describe('optional body\n', function (): void {
		it('-->body = undefined\n', async function (): Promise<void> {
			const result: Date = await new TimeRequest(undefined, { token: '1234' }).execute(executionContext);
			expect(result).toBe(undefined);
		});
		it('-->body = Date\n', async function (): Promise<void> {
			const result: Date = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute(executionContext);
			expect(result.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
		});
	});
});
