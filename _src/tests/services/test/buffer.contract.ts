import { NaniumObject, RequestType, Type } from '../../../objects';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';

export class TestBufferRequestBody extends NaniumObject<TestBufferRequestBody> {
	@Type(String) id: '1';
	@Type(NaniumBuffer) buffer1: NaniumBuffer;
	@Type(NaniumBuffer) buffer2: NaniumBuffer;
}

export class TestBufferResponse extends NaniumObject<TestBufferResponse> {
	@Type(String) id: '1';
	// in step 1 NaniumBuffers are only allowed in requests
	// @Type(NaniumBuffer) buffer1: NaniumBuffer;
	// @Type(NaniumBuffer) buffer2: NaniumBuffer;
	@Type(String) text1: string;
	@Type(String) text2: string;
}

@RequestType({
	responseType: TestBufferResponse,
	genericTypes: { TRequestBody: TestBufferRequestBody },
	scope: 'public'
})
export class TestBufferRequest extends SimpleServiceRequestBase<TestBufferRequestBody, TestBufferResponse> {
	static serviceName: string = 'NaniumTest:test/buffer';
}
