import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';
import { StreamServiceRequestBase } from '../streamServiceRequestBase';

export class TestQueryRequestBody {
	input: number;
}

export class TestDto {
	a: string;
	b: number;
}

export class TestQueryRequest extends StreamServiceRequestBase<TestQueryRequestBody, TestDto> {
	static serviceName: string = 'NocatSelf.TestQuery';
	static scope: ServiceExecutionScope = 'public';
	static responseCoreConstructor: any = TestDto;
}
