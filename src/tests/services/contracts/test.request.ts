import RequestBase from '../../../bases/requestBase';

export default class TestRequest extends RequestBase {
	input1: string;

	constructor(request: TestRequest) {
		super(request);
		this.input1 = request.input1;
	}
}
