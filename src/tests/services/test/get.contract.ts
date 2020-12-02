import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class TestGetRequest extends ServiceRequestBase<TestGetRequestBody, TestGetResponseBody> {
	static serviceName: string = 'NocatSelf.TestGet';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
	static skipInterceptors: boolean = false;
}

export class TestGetRequestBody {
	input1: string;
	input2?: number;
}

export class TestGetResponse extends ServiceResponseBase<TestGetResponseBody> {
}

export class TestGetResponseBody {
	output1: string;
	output2: number;
}

