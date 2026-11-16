import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { NaniumObject, RequestType, Type } from '../../../objects.js';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase.js';

export class TestUpstreamBinaryRequestBody extends NaniumObject<TestUpstreamBinaryRequestBody> {
	@Type(NaniumStream, NaniumBuffer) upstream1?: NaniumStream<NaniumBuffer>;
	@Type(NaniumStream, NaniumBuffer) upstream2?: NaniumStream<NaniumBuffer>;
}

export class TestUpstreamBinaryResponse extends NaniumObject<TestUpstreamBinaryResponse> {
	@Type(Number) upstream1NumberOfReceivedBytes?: number;
	@Type(Number) upstream2NumberOfReceivedBytes?: number;
}

@RequestType({
	responseType: String,
	genericTypes: { TRequestBody: TestUpstreamBinaryRequestBody },
	scope: 'public'
})
export class TestUpstreamBinaryRequest extends SimpleServiceRequestBase<TestUpstreamBinaryRequestBody, TestUpstreamBinaryResponse> {
	static serviceName: string = 'NaniumTest:test/upstreamBinary';
}
