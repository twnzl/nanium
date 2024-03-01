import { RequestType, Type } from '../../../objects';
import { StreamServiceRequestBase } from '../streamServiceRequestBase';

export class TestQueryRequestBody {
	@Type(Number) input: number;
}

export class TestDto {
	@Type(String) a: string;
	@Type(Number) b: number;

	constructor(a: string, b: number) {
		this.a = a;
		this.b = b;
	}

	formatted(): string {
		return this.a + ':' + this.b;
	}
}

@RequestType({
	responseType: TestDto,
	genericTypes: {
		TRequestBody: TestQueryRequestBody,
		TResponseBody: TestDto
	},
	scope: 'public'
})
export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NaniumTest:test/query';
}
