import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { RequestType } from '../../../objects';

export class TestQueryRequestBody {
	input: number;
}

export class TestDto {
	a: string;
	b: number;
}

@RequestType({
	responseType: TestDto,
	genericTypes: { TRequestBody: TestQueryRequestBody },
	scope: 'public'
})
export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NaniumTest:test/query';
}
