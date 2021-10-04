import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';
import { StreamServiceRequestBase } from '../streamServiceRequestBase';

export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NocatSelf.TestQuery';
	static scope: ServiceExecutionScope = 'public';
}

export class TestQueryRequestBody {
	input: number;
}

export interface TestDto {
	a: string;
	b: number;
}
