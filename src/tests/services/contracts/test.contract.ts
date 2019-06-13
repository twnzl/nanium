import { ServiceRequest } from '../../../interfaces/serviceRequest';
import { Nocat } from '../../..';

export class TestRequest implements ServiceRequest<TestResponse> {
	input1: string;
	input2?: number;

	constructor(input1?: string, input2?: number) {
		this.input1 = input1;
		this.input2 = input2;
	}

	async execute(): Promise<TestResponse> {
		return await Nocat.execute(this);
	}
}

export class TestResponse {
	constructor(
		public output1: string,
		public output2: number
	) {
	}
}
