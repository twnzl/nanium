import ServiceRequestBase from '../../../bases/request.base';

export class TestRequest extends ServiceRequestBase<TestRequest, TestResponse> {
	input1: string;
	input2?: number;
}

export class TestResponse {
	constructor(
		public output1: string,
		public output2: number
	) {
	}
}
