import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NocatSelf.TestQuery';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
}

export class TestQueryRequestBody {
	input: number;
}

export interface TestDto {
	a: string;
	b: number;
}
