import { ConstructorType } from '../objects';

export interface NaniumSerializer {
	serialize(obj: any): Promise<string>;

	deserialize(str: string): Promise<any>;

	getData(
		rawData: any,
		ctor: ConstructorType,
		generics: { [id: string]: new() => any; }
	): Promise<{
		data: any;
		rest: any;
	}>;

	packageSeparator: string;
	mimeType: string;
}
