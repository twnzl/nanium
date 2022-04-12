export interface NaniumSerializer {
	serialize(obj: any): Promise<string>;

	deserialize(str: string): Promise<any>;

	getData(
		rawData: any,
		ctor: new (data?: any) => any,
		generics: { [id: string]: new() => any; }
	): Promise<{
		data: any;
		rest: any;
	}>;

	packageSeparator: string;
	mimeType: string;
}
