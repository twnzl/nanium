import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Nanium } from "../../../core";
import { LogLevel, NaniumLogger } from "../../../interfaces/logger";
import { ServiceResponseBase } from "../../services/serviceResponseBase";
import { TimeRequest } from "../../services/test/time.contract";
import { session } from "../../session";
import { TestLogger } from "../../testLogger";
import { TestCore } from "../test-core";

describe('basic browser client tests (Websocket)', () => {

	beforeEach(async () => {

		NaniumLogger.addLogger(new TestLogger(LogLevel.error));
		session.token = '1234';
		session.tenant = 'Company1';
		await TestCore.addWebsocketConsumer();
	});

	afterEach(async () => {
		await Nanium.shutdown();
		session.token = '1234';
		session.tenant = 'Company1';
	});

	describe('execute request via the consumer \n', function (): void {

		it('normal successful execution', async () => {
			await TestCore.normalSuccessfulExecution();
		});

		it('execute and skip interceptor', async (): Promise<void> => {
			await TestCore.skipInterceptor();
		});

		it('test response interceptor\n', async (): Promise<void> => {
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

		it('response with one binary and one dto stream', async () => {
			await TestCore.naniumStreamsInResponse();
		});

		it('NaniumBuffers in request \n', async function (): Promise<void> {
			await TestCore.naniumBuffersRequest();
		});

		it('NaniumBuffers in request but one is undefined \n', async function (): Promise<void> {
			await TestCore.naniumBuffersRequest(false);
		});

		it('body = undefined\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute();
			expect(result.body).toBe(undefined);
		});

		it('body = Date\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute();
			expect(result.body!.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
		});

		it('responsibility / mock provider', async function (): Promise<void> {
			await TestCore.responsibilityForRequestsTest();
		});
	});
});