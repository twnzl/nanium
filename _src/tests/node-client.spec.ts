import { TestExecutionContext } from './services/testExecutionContext';
import * as http from 'http';
import { IncomingMessage } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { URL } from 'url';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestHelper } from './testHelper';
import { AnonymousRequest } from './services/test/anonymous.contract';
import { ServiceResponseBase } from './services/serviceResponseBase';
import { TimeRequest } from './services/test/time.contract';
import { TestNoIORequest } from './services/test/noIO.contract';
import { TestDto } from './services/test/contractparts';
import { Nanium } from '../core';
import { TestGetBinaryRequest } from './services/test/getBinary.contract';
import { NaniumBuffer } from '../interfaces/naniumBuffer';
import { TestGetNaniumBufferRequest } from './services/test/getNaniumBuffer.contract';
import { NaniumStream } from '../interfaces/naniumStream';
import { TestStreamedQueryRequest } from './services/test/streamedQuery.contract';
import { TestStreamedBinaryRequest } from './services/test/streamedBinary.contract';

let request: TestGetRequest;
const executionContext: TestExecutionContext = new TestExecutionContext({ scope: 'private' });
let response: TestGetResponse;

describe('host services via http \n', function (): void {

	beforeAll(async () => {
		await TestHelper.initClientServerScenario('http');
		request = new TestGetRequest({ input1: 'hello world' });
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('execute request via the consumer\n', function (): void {

		it('normal successful execution', async () => {
			request.body.input2 = null;
			response = await request.execute(executionContext);
			expect(response.body.output1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'o2 should be correct').toBe(2);
		});

		it('execute and skip interceptor', async function (): Promise<void> {
			const anonymousRequest: AnonymousRequest = new AnonymousRequest(undefined, {});
			const anonymousResponse: ServiceResponseBase<string> = await anonymousRequest.execute(executionContext);
			expect(anonymousResponse.body, 'output should be correct').toBe(':-)');
		});

		it('execute with error result (handling by errorHandle)', async () => {
			try {
				await new TestGetRequest({ input1: 'hello world' }, { token: 'wrong' }).execute(executionContext);
				expect(false, 'an exception should be thrown').toBeTruthy();
			} catch (e) {
				expect(e.handleError, 'the errorHandler function should have handled the error').toBeDefined();
				expect(e.handleError.message).toBe('unauthorized');
			}
		});

		it('execute with connection error', async () => {
			const apiUrl: string = TestHelper.consumer.config.apiUrl;
			try {
				TestHelper.consumer.config.apiUrl = 'https:/not.available/api';
				await new TestGetRequest({ input1: 'hello world' }).execute(executionContext);
				expect(false, 'an exception should be thrown').toBeTruthy();
			} catch (e) {
				expect((e.message as string).includes('ENOTFOUND'), 'an connection exception should be thrown').toBeTruthy();
			} finally {
				TestHelper.hasServerBeenCalled = false;
				TestHelper.consumer.config.apiUrl = apiUrl;
			}
		});

		it('execute service with void body and void response should without exception', async () => {
			await new TestNoIORequest().execute(executionContext);
		});

		it('--> execute service with Binary response', async () => {
			const result: NaniumBuffer = await new TestGetBinaryRequest().execute();
			expect(new TextDecoder().decode(await result.asUint8Array())).toBe('this is a text that will be send as binary data');
		});

		it('execute service with Binary (NaniumBuffer) response', async () => {
			const result: NaniumBuffer = await new TestGetNaniumBufferRequest().execute();
			expect(await result.asString()).toBe('this is a text that will be send as NaniumBuffer');
		});

		it('response as json stream', async () => {
			const dtoList: TestDto[] = [];
			let portions = 0;
			await new Promise(async (resolve: Function): Promise<void> => {
				const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
					{ amount: 6, msGapTime: 100 }, { token: '1234' }).execute();
				response.onData((value: TestDto): void => {
					portions++;
					dtoList.push(value);
				});
				response.onEnd(() => {
					resolve();
				});
				response.onError((err: Error) => {
					Nanium.logger.error(err.message, err.stack);
				});
			});
			expect(portions, 'result array should be returned in multiple portions').toBe(6);
			expect(dtoList.length, 'length of result list should be correct').toBe(6);
			expect(dtoList[0].formatted()).toBe('1:1');
			expect(dtoList[2].formatted()).toBe('3:3');
		});

		it('response as binary stream', async () => {
			const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();
			const result: NaniumBuffer = new NaniumBuffer();
			await new Promise((resolve: Function) => {
				stream.onData(async (chunk) => {
					result.write(chunk);
				}).onEnd(async () => {
					expect(await result.asString()).toBe('1.2.3.');
					resolve();
				});
			});
		});
	});


	it('call an url of the http server that is not managed by nanium', async () => {
		const result: any = await new Promise<any>(resolve => {
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
		expect(result, 'the original request listener of the server should have handled the request')
			.toBe('*** http fallback ***');
	});

});

describe('host services via https \n', function (): void {
	beforeAll(async () => {
		await TestHelper.initClientServerScenario('https');
		request = new TestGetRequest({ input1: 'hello world' });
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('execute request via the consumer\n', function (): void {
		it('--> the service should have been called via the http channel and should return the right result \n', async () => {
			request.body.input2 = null;
			response = await request.execute(executionContext);
			expect(response.body.output1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'o2 should be correct').toBe(2);
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

	it('-->body = undefined\n', async function (): Promise<void> {
		const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute(executionContext);
		expect(result.body).toBe(undefined);
	});

	it('-->body = Date\n', async function (): Promise<void> {
		const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute(executionContext);
		expect(result.body.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
	});

});
