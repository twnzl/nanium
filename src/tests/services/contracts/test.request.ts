import Nocat from '../../../core';

export default class TestRequest {
	constructor(
		public input1: string,
		public input2?: string
	) {
	}

	async execute?(): Promise<string> {
		return await Nocat.execute(this);
	}
}
