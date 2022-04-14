import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { RequestType } from '../../../objects';

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
	static serviceName: string = 'NaniumTest:test/query';
}
