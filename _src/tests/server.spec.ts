import { Nanium } from '../core';
import { NaniumProviderNodejs } from '../managers/providers/nodejs';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestDto, TestQueryRequest } from './services/test/query.contract';
import { PrivateStuffRequest, PrivateStuffResponse } from './services/test/privateStuff.contract';
import { ServiceResponseBase } from './services/serviceResponseBase';
import { TestExecutionContext } from './services/testExecutionContext';
import { TimeRequest } from './services/test/time.contract';
import { TestLogger } from './testLogger';
import { LogLevel } from '../interfaces/logger';
import { TestStreamedQueryRequest } from './services/test/streamedQuery.contract';
import { TestStreamedQueryExecutor } from './services/test/streamedQuery.executor';
import { NaniumStream } from '../interfaces/naniumStream';

describe('execute TestRequest on server \n', function (): void {
	let request: TestGetRequest;
	let privateRequest: PrivateStuffRequest;
	const executionContext: TestExecutionContext = new TestExecutionContext({ scope: 'private' });
	const testProvider: NaniumProviderNodejs = new NaniumProviderNodejs({
		servicePath: 'tests/services',
		requestInterceptors: [TestServerRequestInterceptor],
		isResponsible: async (): Promise<number> => Promise.resolve(1),
		handleError: async (err: any): Promise<any> => {
			if (err.hasOwnProperty('code')) {
				return new ServiceResponseBase({}, { errors: [err] });
			}
			if (err instanceof Error && err.message === 'no!') {
				return new ServiceResponseBase({}, { exceptions: [{ code: 'ErrorLogId0815' }] });
			}
			throw err;
		}
	});

	let response: TestGetResponse;
	let privateResponse: PrivateStuffResponse;

	beforeEach(async function (): Promise<void> {
		Nanium.logger = new TestLogger(LogLevel.info);
		request = new TestGetRequest({ input1: 'hello world' });
		privateRequest = new PrivateStuffRequest(1);
		await Nanium.addManager(testProvider);
	});

	it('--> Services should have been initialized and info should have been logged \n', async function (): Promise<void> {
		expect((Nanium.logger as TestLogger).infos.length > 0).toBeTruthy();
		expect((Nanium.logger as TestLogger).infos[0].toString().startsWith('service ready: NaniumTest:')).toBeTruthy();
	});

	describe('execute successful \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = null;
			response = await request.execute(executionContext);
		});

		it('--> \n', async function (): Promise<void> {
			expect(response.body.output1, 'output1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'output2 should be correct').toBe(2);
		});
	});

	describe('execute with error \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 4;
			response = await request.execute(executionContext);
		});

		test('-->  \n', async function (): Promise<void> {
			expect(response.head, 'response head should be set').not.toBeUndefined();
			expect(response.head.errors, 'response head.error should be set').not.toBeUndefined();
			expect(response.head.errors.length, 'response.head.error should contain one exception').toBe(1);
			expect(response.head.errors[0].code, 'the error in the response should have the right code').toBe('E2');
			expect(response.head.errors[0].text, 'the error in the response should have the right text').toBe('Error 2');
		});
	});

	describe('execute with exception \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 5;
			response = await request.execute(executionContext);
		});

		it('-->  \n', async function (): Promise<void> {
			expect(response.head, 'response head should be set').not.toBeUndefined();
			expect(response.head.exceptions, 'response head.exceptions should be set').not.toBeUndefined();
			expect(response.head.exceptions.length, 'response.head.exceptions should contain one exception').toBe(1);
			expect(response.head.exceptions[0].code, 'the exception in the response should have the right code').toBe('ErrorLogId0815');
			expect(response.head.exceptions[0].text, 'the exception.text should be not set').toBeUndefined();
		});
	});

	describe('execute with unhandled exception \n', function (): void {
		let exception: Error;

		beforeEach(async function (): Promise<void> {
			response = undefined;
			request.body.input2 = 10;
			try {
				response = await request.execute(executionContext);
			} catch (e) {
				exception = e;
			}
		});

		it('-->  \n', async function (): Promise<void> {
			expect(response, 'response should not be set').toBeUndefined();
			expect(exception.message, 'promise should have been rejected with an object of type Error and the right message').toBe('no no!');
		});
	});

	describe('streamed successful response \n', function (): void {
		const dtoList: TestDto[] = [];

		beforeEach(async function (): Promise<void> {
			await new Promise((resolve: Function): void => {
				new TestQueryRequest({ input: 1 }, { token: '1234' }).stream().subscribe({
					next: (value: TestDto): void => {
						dtoList.push(value);
					},
					complete: (): void => resolve(),
					error: (err: Error) => {
						Nanium.logger.error(err.message, err.stack);
					}
				});
			});
		});

		it('-->  \n', async function (): Promise<void> {
			expect(dtoList.length, 'length of result list should be correct').toBe(999);
		});
	});

	describe('streamed service as Promise \n', function (): void {
		let dtoList: TestDto[];

		beforeEach(async function (): Promise<void> {
			dtoList = await new TestQueryRequest({ input: 1 }, { token: '1234' }).execute();
		});

		it('-->  \n', async function (): Promise<void> {
			expect(dtoList.length, 'length of result list should be correct').toBe(999);
			expect(dtoList[0].a, 'property a of first result should be correct').toBe('1');
			expect(dtoList[0].b, 'property b of first result should be correct').toBe(1);
		});
	});

	describe('stream as service response', function (): void {
		test('-->', async function (): Promise<void> {
			const dtoList: TestDto[] = [];
			let portions = 0;
			await new Promise(async (resolve: Function): Promise<void> => {
				const response: NaniumStream<TestDto> = await new TestStreamedQueryExecutor()
					.execute(new TestStreamedQueryRequest({ amount: 6, msGapTime: 100 }, { token: '1234' }));
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
	});

	describe('execute private service without scope \n', function (): void {
		beforeEach(async function (): Promise<void> {
			privateResponse = await privateRequest.execute(executionContext);
		});

		it('--> \n', async function (): Promise<void> {
			expect(privateResponse.body, 'result should be correct').toBe(2);
		});
	});

	describe('execute private service with scope public \n', function (): void {
		let err: Error;

		beforeEach(async function (): Promise<void> {
			try {
				privateResponse = await Nanium.execute(privateRequest, 'NaniumTest:test/privateStuff', { scope: 'public' });
			} catch (e) {
				err = e;
			}
		});

		it('--> \n', async function (): Promise<void> {
			expect(err.message, 'result should be correct').toBe('unauthorized');
		});
	});

	describe('When the request comes serialized over HTTP ore something else, the request that ist passed to the executor must be a real instance of the request type not only a DTO \n', function (): void {
		beforeEach(async function (): Promise<void> {
			const r: PrivateStuffRequest = <PrivateStuffRequest>{ body: 1, head: { token: '1234' } };
			privateResponse = await Nanium.execute(r, 'NaniumTest:test/privateStuff');
		});

		it('--> \n', async function (): Promise<void> {
			expect(privateResponse.body, 'result should be correct').toBe(2);
		});
	});

	describe('optional body\n', function (): void {
		it('-->body = undefined\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute(executionContext);
			expect(result.body).toBe(undefined);
		});
		it('-->body = Date\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute(executionContext);
			expect(result.body.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
		});
	});

	describe('remove manager \n', function (): void {
		beforeEach(async function (): Promise<void> {
			await Nanium.removeManager(testProvider);
		});

		it('--> manager should be terminated and removed \n', async function (): Promise<void> {
			expect(Nanium.managers.length).toBe(0);
		});
	});
});

