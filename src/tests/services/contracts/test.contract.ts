import {ServiceRequestBase} from '../../../bases/request.base';
import {ServiceResponseBase} from '../../../bases/response.base';

export class TestRequest extends ServiceRequestBase<TestRequestBody, TestResponseBody> {
}

export class TestRequestBody {
	input1: string;
	input2?: number;
}

export class TestResponse extends ServiceResponseBase<TestResponseBody> {
}

export class TestResponseBody {
	output1: string;
	output2: number;
}
