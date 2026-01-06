import { NaniumStream } from '../../../interfaces/naniumStream';
import { NaniumObject, RequestType, Type } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';
import { TestDto } from './contractparts';

export class TestUpstreamObjectsRequestBody extends NaniumObject<TestUpstreamObjectsRequestBody> {
	@Type(NaniumStream, TestDto) upstream1?: NaniumStream<TestDto>;
	@Type(NaniumStream, TestDto) upstream2?: NaniumStream<TestDto>;
}

export class TestUpstreamObjectsResponse extends NaniumObject<TestUpstreamObjectsResponse> {
	@Type(Array, TestDto) receivedObjects1?: TestDto[];
	@Type(Array, TestDto) receivedObjects2?: TestDto[];
}

@RequestType({
	responseType: String,
	genericTypes: { TRequestBody: TestUpstreamObjectsRequestBody },
	scope: 'public'
})
export class TestUpstreamObjectsRequest extends SimpleServiceRequestBase<TestUpstreamObjectsRequestBody, TestUpstreamObjectsResponse> {
	static serviceName: string = 'NaniumTest:test/upstreamObjects';
}
