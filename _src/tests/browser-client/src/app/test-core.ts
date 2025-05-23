import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { AnonymousRequest } from '../../../services/test/anonymous.contract';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import { TestNoIORequest } from '../../../services/test/noIO.contract';
import { TestGetBinaryRequest } from '../../../services/test/getBinary.contract';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { TestGetNaniumBufferRequest } from '../../../services/test/getNaniumBuffer.contract';
import { TestBufferRequest } from '../../../services/test/buffer.contract';

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

	static async arrayBufferResponse() {
		const result = await new TestGetBinaryRequest().execute();
		expect(await result.asString()).toBe('this is a text that will be send as binary data');
	}

	static async naniumBufferResponse() {
		const result: NaniumBuffer = await new TestGetNaniumBufferRequest().execute();
		expect(await result.asString()).toBe('this is a text that will be send as NaniumBuffer');
	}

	static async naniumBuffersRequest() {
		const request = new TestBufferRequest({
			id: '1',
			buffer1: new NaniumBuffer(new TextEncoder().encode('123')),
			buffer2: new NaniumBuffer(new TextEncoder().encode('456'))
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
			buffer1: new NaniumBuffer(new TextEncoder().encode('123')),
			buffer2: undefined
		});
		const response = await request.execute();
		expect(response.id).toBe('1');
		expect(response.text1).toBe('123*');
		expect(response.text2).toBeUndefined();
		return response;
	}
}
