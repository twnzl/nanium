import Nocat from '../../../core';
import ServiceRequest from '../../../interfaces/serviceRequest';

export default class TestRequest implements ServiceRequest {
	constructor(
		public input1: string,
		public input2?: string
	) {
	}

	async execute(): Promise<string> {
		return await Nocat.execute(this);
	}
}
