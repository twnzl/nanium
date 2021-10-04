import { Nocat } from '../core';
import { NocatNodejsProvider } from '../managers/providers/nodejs';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract';
import { TestDto, TestQueryRequest } from './services/test/query.contract';
import { PrivateStuffRequest, PrivateStuffResponse } from './services/test/privateStuff.contract';
import { ServiceResponseBase } from './services/serviceResponseBase';
import { AnonymousRequest } from './services/test/anonymous.contract';
import { LogMode } from '../interfaces/logMode';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';

describe('execute TestRequest on server \n', function (): void {
	const request: TestGetRequest = new TestGetRequest({ input1: 'hello world' }, { token: '1234' });
	const privateRequest: PrivateStuffRequest = new PrivateStuffRequest(1, { token: '1234' });
	let response: TestGetResponse;
	let privateResponse: PrivateStuffResponse;

	beforeEach(async function (): Promise<void> {
		await Nocat.addManager(new NocatNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services',
			requestInterceptors: { test: TestServerRequestInterceptor },
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			handleError: async (err: any): Promise<any> => {
				if (err.hasOwnProperty('code')) {
					return new ServiceResponseBase({}, { errors: [err] });
				}
				if (err instanceof Error && err.message === 'no!') {
					return new ServiceResponseBase({}, { exceptions: [{ code: 'ErrorLogId0815' }] });
				}
				throw err;
			}
		}));
	});

	describe('execute successful \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = null;
			response = await request.execute();
		});

		it('--> \n', async function (): Promise<void> {
			expect(response.body.output1, 'output1 should be correct').toBe('hello world :-)');
			expect(response.body.output2, 'output2 should be correct').toBe(2);
		});
	});

	describe('execute skip interceptor \n', function (): void {
		const anonymousRequest: AnonymousRequest = new AnonymousRequest();
		let anonymousResponse: ServiceResponseBase<string>;
		beforeEach(async function (): Promise<void> {
			anonymousResponse = await anonymousRequest.execute();
		});

		it('--> \n', async function (): Promise<void> {
			expect(anonymousResponse.body, 'output should be correct').toBe(':-)');
		});
	});

	describe('execute with error \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 4;
			response = await request.execute();
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
			response = await request.execute();
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
				response = await request.execute();
			} catch (e) {
				exception = e;
			}
		});

		it('-->  \n', async function (): Promise<void> {
			expect(response, 'response should not be set').toBeUndefined();
			expect(exception.message, 'promise should have been rejected with an object of type Error and the right message').toBe('no no!');
		});
	});

	describe('stream successful response \n', function (): void {
		const dtoList: TestDto[] = [];

		beforeEach(async function (): Promise<void> {
			await new Promise((resolve: Function): void => {
				new TestQueryRequest({ input: 1 }, { token: '1234' }).execute().subscribe({
					next: (value: TestDto): void => {
						dtoList.push(value);
					},
					complete: (): void => resolve()
				});
			});
		});

		it('-->  \n', async function (): Promise<void> {
			expect(dtoList.length, 'length of result list should be correct').toBe(3);
		});
	});

	describe('execute private service without scope \n', function (): void {
		beforeEach(async function (): Promise<void> {
			privateResponse = await privateRequest.execute();
		});

		it('--> \n', async function (): Promise<void> {
			expect(privateResponse.body, 'result should be correct').toBe(2);
		});
	});

	describe('execute private service with scope public \n', function (): void {
		let err: Error;

		beforeEach(async function (): Promise<void> {
			try {
				privateResponse = await Nocat.execute(privateRequest, 'NocatSelf.PrivateStuff', { scope: 'public' });
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
			privateResponse = await Nocat.execute(r, 'NocatSelf.PrivateStuff');
		});

		it('--> \n', async function (): Promise<void> {
			expect(privateResponse.body, 'result should be correct').toBe(2);
		});
	});
});

