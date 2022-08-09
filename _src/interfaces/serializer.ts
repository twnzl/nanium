import { ConstructorType } from '../objects';

export interface NaniumSerializer {
	serialize(obj: any): string | ArrayBuffer;

	deserialize(raw: string | ArrayBuffer): any;

	deserializePartial(
		rawData: string | ArrayBuffer,
		ctor: ConstructorType,
		generics: { [id: string]: new() => any; },
		restFromLastTime?: any
	): {
		data: any;
		rest: any;
	};

	packageSeparator: string;
	mimeType: string;
}
