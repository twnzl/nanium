import { Type } from '../../../objects';

export class TestQueryRequestBody {
	@Type(Number) input: number;
}

export class TestDto {
	@Type(String) a: string;
	@Type(Number) b: number;

	constructor(a: string, b: number) {
		this.a = a;
		this.b = b;
	}

	formatted(): string {
		return this.a + ':' + this.b;
	}
}
