import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { RequestType } from '../../../serializers/core';
import { ServiceResponseBase } from '../serviceResponseBase';

export class TestQueryRequestBody {
	input: number;
}

export class TestDto {
	a: string;
	b: number;
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
	static serviceName: string = 'NocatSelf.TestQuery';
}
