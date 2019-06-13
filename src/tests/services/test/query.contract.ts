import { ServiceRequestBase } from '..//serviceRequestBase';
import { ServiceResponseBase } from '..//serviceResponseBase';

export class TestQueryRequest extends ServiceRequestBase<TestQueryRequestBody, TestQueryResponseBody> {
	static serviceName: string = 'TestQuery';
}

export class TestQueryRequestBody {
	input1: string;
	input2?: number;
}

export class TestQueryResponse extends ServiceResponseBase<TestQueryResponseBody> {
}

export class TestQueryResponseBody {
	output1: string;
	output2: number;
}

