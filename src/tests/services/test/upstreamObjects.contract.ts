import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { NaniumObject, RequestType, Type } from '../../../objects.js';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase.js';
import { TestDto } from './contractparts.js';

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
