import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Nanium } from "../../../core";
import { LogLevel, NaniumLogger } from "../../../interfaces/logger";
import { NaniumBuffer } from "../../../interfaces/naniumBuffer";
import { ServiceResponseBase } from "../../services/serviceResponseBase";
import { TestBufferRequest } from "../../services/test/buffer.contract";
import { TestGetRequest } from "../../services/test/get.contract";
import { TimeRequest } from "../../services/test/time.contract";
import { session } from "../../session";
import { TestLogger } from "../../testLogger";
import { TestCore } from "../test-core";

describe('basic browser client tests (HTTP)', () => {
	beforeEach(async () => {
		NaniumLogger.addLogger(new TestLogger(LogLevel.error));
		session.token = '1234';
		session.tenant = 'Company1';
		await TestCore.addHttpConsumer();
	});

	afterEach(async () => {
		await Nanium.shutdown();
		session.token = '1234';
		session.tenant = 'Company1';
	});

	afterAll(async () => {
		await new Promise(resolve => setTimeout(resolve, 500)); // Short break for GC
	});

	describe('execute request via the consumer \n', function (): void {

		it('normal successful execution', async () => {
			await TestCore.normalSuccessfulExecution();
		});

		it('execute and skip interceptor', async function (): Promise<void> {
			await TestCore.skipInterceptor();
		});

		it('test response interceptor\n', async function (): Promise<void> {
			await TestCore.responseInterceptor();
		});

		it('execute with error result (handling by errorHandle)', async () => {
			await TestCore.withErrorResult();
		});

		it('execute service with void body and void response', async () => {
			await TestCore.voidBodyAndVoidResponse();
		});

		it('execute service with Binary (NaniumBuffer) response', async () => {
			await TestCore.naniumBufferResponse();
		});

		it('response as json stream', async () => {
			await TestCore.responseAsJsonStream();
		});

		it('response as json stream toPromise()', async () => {
			await TestCore.responseAsJsonStreamToPromise();
		});

		it('response as binary stream', async () => {
			await TestCore.responseAsBinaryStream();
		});

		it('NaniumBuffers in request \n', async function (): Promise<void> {
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer().writeString('123'),
				buffer2: new NaniumBuffer().writeString('456')
			});
			const response = await request.execute();
			expect(response.id).toBe('1');
			expect(response.text1).toBe('123*');
			expect(response.text2).toBe('456*');
		});

		it('NaniumBuffers in request but one is undefined \n', async function (): Promise<void> {
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer().writeString('123'),
				buffer2: undefined
			});
			const response = await request.execute();
			expect(response.id).toBe('1');
			expect(response.text1).toBe('123*');
			expect(response.text2).toBeUndefined();
		});

		it('call an url of the http server that is not managed by nanium', async () => {
			const result: any = await new Promise<any>(resolve => {
				fetch('http://localhost:8080/stuff').then(async response => {
					const str: string = await response.text();
					resolve(str);
				}).catch(err => { throw(err); });
			});
			expect(result).toBe('*** http fallback ***'); // the original request listener of the server should have handled the request
		});

		it('body = undefined\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute();
			expect(result.body).toBe(undefined);
		});

		it('body = Date\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute();
			expect(result.body.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
		});

		it('responsibility / mock provider', async function (): Promise<void> {
			await TestCore.responsibilityForRequestsTest();
		});
	});

	describe('test browser client with wrong api url', () => {

		beforeEach(async () => {
			await TestCore.addHttpConsumer('https://not.available');
		});

		afterEach(async () => {
			await Nanium.shutdown();
		});

		it('execute with connection error', async () => {
			try {
				await new TestGetRequest({ input1: 'hello world' }).execute();
				expect(false).toBeTruthy(); // an exception should be thrown
			} catch (e) {
				expect(e).toBeDefined(); // an exception should be thrown
			}
		});
	});
});
