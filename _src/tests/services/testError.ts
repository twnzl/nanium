import { NaniumObject, Type } from '../../objects';

export class TestError extends NaniumObject<TestError> {
	@Type(String) type: 'exception' | 'validation';
	@Type(String) code: string;
	@Type(String) message: string;
}
