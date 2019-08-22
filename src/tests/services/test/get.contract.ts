import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { ServiceExecutionScope } from '../../..';

export class TestGetRequest extends ServiceRequestBase<TestGetRequestBody, TestGetResponseBody> {
	static serviceName: string = 'TestGet';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
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

