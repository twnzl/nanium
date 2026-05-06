import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { NaniumObject, RequestType, Type } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';
import { TestDto } from './contractparts';

export class TestStreamsRequestBody extends NaniumObject<TestStreamsRequestBody> {
	@Type(String) id: string;
	@Type(NaniumStream, NaniumBuffer) stream1: NaniumStream<NaniumBuffer>;
	@Type(NaniumStream, TestDto) stream2: NaniumStream<TestDto>;
}

export class TestStreamsResponse extends NaniumObject<TestStreamsResponse> {
	@Type(String) id: string;
	@Type(NaniumStream, NaniumBuffer) stream1: NaniumStream<NaniumBuffer>;
	@Type(NaniumStream, TestDto) stream2: NaniumStream<TestDto>;
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
