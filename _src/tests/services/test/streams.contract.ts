import { NaniumStream } from '../../../interfaces/naniumStream';
import { NaniumObject, RequestType, Type } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';

export class TestStreamsRequestBody extends NaniumObject<TestStreamsRequestBody> {
	@Type(String) id: string;
	@Type(NaniumStream) stream1: NaniumStream;
	@Type(NaniumStream) stream2: NaniumStream;
}

export class TestStreamsResponse extends NaniumObject<TestStreamsResponse> {
	@Type(String) id: string;
	@Type(NaniumStream) stream1: NaniumStream;
	@Type(NaniumStream) stream2: NaniumStream;
	@Type(String) text1?: string;
	@Type(String) text2?: string;
}

@RequestType({
	responseType: TestStreamsResponse,
	genericTypes: { TRequestBody: TestStreamsRequestBody },
	scope: 'public'
})
export class TestStreamsRequest extends SimpleServiceRequestBase<TestStreamsRequestBody, TestStreamsResponse> {
	static serviceName: string = 'NaniumTest:test/streams';
}
