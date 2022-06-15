import { Nanium } from '../core';
import { NaniumProviderNodejs } from '../managers/providers/nodejs';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestDto, TestQueryRequest } from './services/test/query.contract';
import { PrivateStuffRequest } from './services/test/privateStuff.contract';
import { ServiceError } from './services/serviceResponseBase';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';
import { ServiceRequestContext } from './services/serviceRequestContext';
import { TimeRequest } from './services/test/time.contract';
import { TestBinaryStreamRequest } from './services/test/binaryStream.contract';
import { Buffer } from 'buffer';
import { TestBinaryRequest } from './services/test/binary.contract';

describe('execute TestRequest on server \n', function (): void {
	const request: TestGetRequest = new TestGetRequest({ input1: 'hello world' });
	const privateRequest: PrivateStuffRequest = new PrivateStuffRequest(1);
	const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });
	const testProvider: NaniumProviderNodejs = new NaniumProviderNodejs({
		servicePath: 'tests/services',
		requestInterceptors: [TestServerRequestInterceptor],
		isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
		handleError: async (err: any): Promise<any> => {
			if (err.hasOwnProperty('code')) {
				throw new ServiceError({ errors: [err] });
			}
			if (err instanceof Error && err.message === 'no!') {
				throw new ServiceError({ exceptions: [{ code: 'ErrorLogId0815' }] });
			}
			throw err;
		}
	});

	let response: TestGetResponse;
	let privateResponse: number;

	beforeEach(async function (): Promise<void> {
		await Nanium.addManager(testProvider);
	});

	describe('execute successful \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = null;
			response = await request.execute(executionContext);
		});

		it('--> \n', async function (): Promise<void> {
			expect(response.output1, 'output1 should be correct').toBe('hello world :-)');
			expect(response.output2, 'output2 should be correct').toBe(2);
		});
	});

	describe('execute with error \n', function (): void {
		let err: ServiceError;

		beforeEach(async function (): Promise<void> {
			request.body.input2 = 4;
			try {
				response = await request.execute(executionContext);
			} catch (e) {
				err = e;
			}
		});

		test('-->  \n', async function (): Promise<void> {
			expect(err instanceof ServiceError, 'execution should have finished with exception of type ServiceError').toBeTruthy();
			expect(err.errors, 'errors should be set').not.toBeUndefined();
			expect(err.errors.length, 'errors should contain one exception').toBe(1);
			expect(err.errors[0].code, 'the error should have the right code').toBe('E2');
			expect(err.errors[0].text, 'the error should have the right text').toBe('Error 2');
		});
	});

	describe('execute with exception \n', function (): void {
		let err: ServiceError;
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 5;
			try {
				response = await request.execute(executionContext);
			} catch (e) {
				err = e;
			}
		});

		it('-->  \n', async function (): Promise<void> {
			expect(err instanceof ServiceError, 'execution should have finished with exception of type ServiceError').toBeTruthy();
			expect(err.exceptions, 'exceptions should be set').not.toBeUndefined();
			expect(err.exceptions.length, 'exceptions should contain one exception').toBe(1);
			expect(err.exceptions[0].code, 'the exception should have the right code').toBe('ErrorLogId0815');
			expect(err.exceptions[0].text, 'the exception.text should be not set').toBeUndefined();
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
						console.log(err.message);
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

	describe('execute private service without scope \n', function (): void {
		beforeEach(async function (): Promise<void> {
			privateResponse = await privateRequest.execute(executionContext);
		});

		it('--> \n', async function (): Promise<void> {
			expect(privateResponse, 'result should be correct').toBe(2);
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
			expect(privateResponse, 'result should be correct').toBe(2);
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

	describe('remove manager \n', function (): void {
		beforeEach(async function (): Promise<void> {
			await Nanium.removeManager(testProvider);
		});

		it('--> manager should be terminated and removed \n', async function (): Promise<void> {
			expect(Nanium.managers.length).toBe(0);
		});
	});

	describe('execute with binary result \n', function (): void {
		it('--> result should be a Buffer \n', async function (): Promise<void> {
			const result: Buffer = await new TestBinaryRequest(undefined, { token: '1234' }).execute(executionContext);
			expect(result instanceof Buffer, 'response should be of type Buffer').toBeTruthy();
			expect(result.toString(), 'the whole content should be correct').toBe('Hello World!');
		});
	});

	describe('binary streaming \n', function (): void {
		it('--> result should be streamed as multiple Buffers \n', async function (): Promise<void> {
			const result: Buffer[] = [];
			await new TestBinaryStreamRequest(undefined, { token: '1234' }).stream().subscribe({
				next: (value) => {
					result.push(value);
				},
				complete: () => {
					expect(result.length, 'the result should have been send as 4 packages').toBe(4);
					expect(result[0] instanceof Buffer, 'the results should be of type Buffer').toBeTruthy();
					const txt: string = result.map(b => b.toString('utf8')).join('');
					expect(txt, 'the whole content should be correct').toBe('Hello World!');
				}
			});
		});
	});
});

