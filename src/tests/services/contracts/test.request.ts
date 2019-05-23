import Nocat from '../../../core';

export default class TestRequest {
	input1: string;

	constructor(request: TestRequest) {
		this.input1 = request.input1;
	}

	async execute?(): Promise<string> {
		return await Nocat.execute(this);
	}
}
