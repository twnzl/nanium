import { Nocat } from '../core';
import { NocatServer } from '../managers/server';
import { TestQueryRequest, TestQueryResponse } from './services/test/query.contract';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestServerResponseInterceptor } from './interceptors/server/test.response.interceptor';
import { LogMode } from '..';
import { ServiceResponseBase, ServiceResponseMessage } from './services/serviceResponseBase';

describe('execute TestRequest on server \n', function (): void {
	const request: TestQueryRequest = new TestQueryRequest({ input1: 'hello world' });
	let response: TestQueryResponse;

	beforeEach(async function (): Promise<void> {
		await Nocat.init(new NocatServer({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services',
			requestInterceptors: [new TestServerRequestInterceptor()],
			responseInterceptors: [new TestServerResponseInterceptor()],
			handleError: (err: any): any => {
				if (err instanceof ServiceResponseMessage) {
					return new ServiceResponseBase({}, { errors: [err] });
				}
				if (err instanceof Error && err.message === 'no!') {
					return new ServiceResponseBase({}, { exceptions: [{ code: 'ErrorLogId0815' }] });
				}
				throw err;
			}
		}));
	});

	describe('execute successfull \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = null;
			response = await request.execute();
		});

		it('--> \n', async function (): Promise<void> {
			expect(response.body.output1).toBe('hello world :-)', 'output1 should be correct');
			expect(response.body.output2).toBe(2, 'output2 should be correct');
			expect(request.head.token).toBe('1234', 'the property head.token should have been set by the server request interceptor');
			expect(response.head['tmp']).toBe(':-)', 'the property head.tmp should have been set by the server response interceptor');
		});
	});

	describe('execute with error \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 4;
			response = await request.execute();
		});

		it('-->  \n', async function (): Promise<void> {
			expect(response.head).not.toBeUndefined('response head should be set');
			expect(response.head.errors).not.toBeUndefined('response head.error should be set');
			expect(response.head.errors.length).toBe(1, 'response.head.error should contain one exception');
			expect(response.head.errors[0].code).toBe('E2', 'the error in the response should have the right code');
			expect(response.head.errors[0].text).toBe('Error 2', 'the error in the response should have the right text');
		});
	});

	describe('execute with exception \n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.input2 = 5;
			response = await request.execute();
		});

		it('-->  \n', async function (): Promise<void> {
			expect(response.head).not.toBeUndefined('response head should be set');
			expect(response.head.exceptions).not.toBeUndefined('response head.exceptions should be set');
			expect(response.head.exceptions.length).toBe(1, 'response.head.exceptions should contain one exception');
			expect(response.head.exceptions[0].code).toBe('ErrorLogId0815', 'the exception in the response should have the right code');
			expect(response.head.exceptions[0].text).toBeUndefined('the exception.text should be not set');
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
			expect(response).toBeUndefined('response should not be set');
			expect(exception.message).toBe('no no!', 'promise should have been rejected with an object of type Error and the right message');
		});
	});
});

