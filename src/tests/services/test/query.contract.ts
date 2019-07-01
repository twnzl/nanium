import { StreamServiceRequestBase } from '../streamServiceRequestBase';

export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'TestQuery';
}

export class TestQueryRequestBody {
	input: number;
}

export interface TestDto {
	a: string;
	b: number;
}
