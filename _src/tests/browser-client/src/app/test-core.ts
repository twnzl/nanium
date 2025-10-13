import { Nanium } from '../../../../core';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../../interfaces/naniumStream';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { AnonymousRequest } from '../../../services/test/anonymous.contract';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { TestDto } from '../../../services/test/contractparts';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { TestGetNaniumBufferRequest } from '../../../services/test/getNaniumBuffer.contract';
import { TestNoIORequest } from '../../../services/test/noIO.contract';
import { TestStreamedBinaryRequest } from '../../../services/test/streamedBinary.contract';
import { TestStreamedQueryRequest } from '../../../services/test/streamedQuery.contract';
import { TestStreamsRequest } from '../../../services/test/streams.contract';

export class TestCore {

	static async normalSuccessfulExecution() {
		let response: ServiceResponseBase<TestGetResponseBody>;
		response = await new TestGetRequest({ input1: 'hello world' }).execute();
		expect(response?.body?.output1).withContext('output1 should be correct').toBe('hello world :-)');
		expect(response?.body?.output2).withContext('output2 should be correct').toBe(2);
	}

	static async skipInterceptor() {
		const anonymousRequest: AnonymousRequest = new AnonymousRequest(undefined, {});
		const anonymousResponse: ServiceResponseBase<string> = await anonymousRequest.execute();
		expect(anonymousResponse.body).withContext('output should be correct').toBe(':-)');
	}

	static async responseInterceptor() {
		let response: ServiceResponseBase<TestGetResponseBody>;
		TestClientResponseInterceptor.responseCnt = 0;
		response = await new TestGetRequest({ input1: '111' }).execute();
		expect(response?.body?.output1).withContext('output1 should be the original result from the service executor').toBe('111 :-)');
		expect(TestClientResponseInterceptor.responseCnt).toBe(1);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnDifferentResponse' }).execute();
		expect(response?.body?.output1).withContext('output1 should be the result that the interceptor returned').toBe('ResultFromInterceptor');
		expect(TestClientResponseInterceptor.responseCnt).toBe(2);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnNull' }).execute();
		expect(response).withContext('response should be null because interceptor returned null').toBeNull();
		expect(TestClientResponseInterceptor.responseCnt).toBe(3);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnUndefined' }).execute();
		expect(response.body.output1).withContext('output1 should be the original result from the service executor, because interceptor returned undefined').toBe('TestResponseInterceptor:ReturnUndefined :-)');
		expect(TestClientResponseInterceptor.responseCnt).toBe(4);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnSameResponseInstance' }).execute();
		expect(response.body.output1).withContext('output1 should be the original result from the service executor, because interceptor returned original response instance').toBe('TestResponseInterceptor:ReturnSameResponseInstance :-)');
		expect(TestClientResponseInterceptor.responseCnt).toBe(5);
	}

	static async withErrorResult() {
		try {
			await new TestGetRequest({ input1: 'hello world' }, { token: 'wrong' }).execute();
			expect(false).withContext('an exception should be thrown').toBeTruthy();
		} catch (e) {
			expect(e.handleError).withContext('the errorHandler function should have handled the error').toBeDefined();
			expect(e.handleError.message).toBe('unauthorized');
		}
	}

	static async voidBodyAndVoidResponse() {
		await new TestNoIORequest().execute();
		expect(true).toBeTruthy();
	}

	static async naniumBufferResponse() {
		const result: NaniumBuffer = await new TestGetNaniumBufferRequest().execute();
		expect(result.asString()).toBe('this is a text that will be send as NaniumBuffer');
	}

	static async naniumBuffersRequest() {
		const request = new TestBufferRequest({
			id: '1',
			buffer1: await NaniumBuffer.create(new TextEncoder().encode('123')),
			buffer2: await NaniumBuffer.create(new TextEncoder().encode('456'))
		});
		const response = await request.execute();
		expect(response.id).toBe('1');
		expect(response.text1).toBe('123*');
		expect(response.text2).toBe('456*');
		return response;
	}

	static async naniumBuffersRequestWithOneUndefined() {
		const request = new TestBufferRequest({
			id: '1',
			buffer1: await NaniumBuffer.create(new TextEncoder().encode('123')),
			buffer2: undefined
		});
		const response = await request.execute();
		expect(response.id).toBe('1');
		expect(response.text1).toBe('123*');
		expect(response.text2).toBeUndefined();
		return response;
	}

	static async naniumStreamJson() {
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
		expect(portions).withContext('result array should be returned in multiple portions').toBe(6);
		expect(dtoList.length).withContext('length of result list should be correct').toBe(6);
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async naniumStreamToPromise() {
		const responseStream: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
			{ amount: 6, msGapTime: 0 }, { token: '1234' }).execute();
		const dtoList: TestDto[] = await responseStream.toPromise();
		expect(dtoList.length).withContext('length of result list should be correct').toBe(6);
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async naniumStreamBinary() {
		try {
			const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();

			// todo: problem ist, dass durch das await auf die response, der Inhalt des streams bereits übertragen wird
			// und dann ohne onData - function (in browserws.handleResponseStreamChunk) entgegengenommen wird,
			// 	noch bevor es hier mit der Ausführung weiter geht und die onData - function registriert werden kann.
			// wie kann ich sicher stellen, dass die Ausführung hier weiter geht, bevor der Inhalt des streams entgegengenommen wird ?

			const result: NaniumBuffer = new NaniumBuffer();
			await new Promise((resolve: Function) => {
				stream.onData(async (chunk) => {
					await result.write(chunk);
				}).onEnd(async () => {
					expect(await result.asString()).toBe('1.2.3.');
					resolve();
				});
			});
		} catch (err) {
			console.error(err.message, err.stack);
		}
	}

	static async naniumStreamsInResponse() {
		const request = new TestStreamsRequest({
			id: '1',
			stream1: new NaniumStream(),
			stream2: new NaniumStream(),
		});
		request.body.stream1.write(new TextEncoder().encode('123'));
		request.body.stream2.write(new TextEncoder().encode('456'));
		request.body.stream1.end();
		request.body.stream2.end();
		const response = await request.execute();
		const data1: NaniumBuffer = new NaniumBuffer();
		const data2: NaniumBuffer = new NaniumBuffer();
		await Promise.all([
			new Promise<void>((resolve) => {
				response.stream1.onData(async (data: Uint8Array) => {
					const text = new TextDecoder().decode(data);
					await data1.write(data);
				});
				response.stream1.onEnd(() => {
					resolve();
				});
			}),
			new Promise<void>((resolve) => {
				response.stream2.onData(async (data: Uint8Array) => {
					const text = new TextDecoder().decode(data);
					await data2.write(data);
				});
				response.stream2.onEnd(() => {
					resolve();
				});
			})
		]);
		expect(await data1.asString()).toBe('123*');
		expect(await data2.asString()).toBe('456*');
	}
}
