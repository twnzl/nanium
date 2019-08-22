import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { ServiceExecutionScope } from '../../..';

export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'TestQuery';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
}

export class TestQueryRequestBody {
	input: number;
}

export interface TestDto {
	a: string;
	b: number;
}
