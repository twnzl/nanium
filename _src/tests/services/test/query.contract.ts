import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { RequestType, Type } from '../../../objects';

export class TestQueryRequestBody {
	@Type(Number) input: number;
}

export class TestDto {
	@Type(String) a: string;
	@Type(Number) b: number;
}

@RequestType({
	responseType: ServiceResponseBase,
	genericTypes: {
		TRequestBody: TestQueryRequestBody,
		TResponseBody: TestDto
	},
	scope: 'public'
})
export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NaniumTest:test/query';
}
