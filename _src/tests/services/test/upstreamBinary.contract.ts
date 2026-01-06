import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { NaniumObject, RequestType, Type } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';

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
