export interface NaniumSerializer {
	serialize(obj: any): string | ArrayBuffer;

	deserialize(raw: string | ArrayBuffer): any;

	deserializePartial(
		rawData: string | ArrayBuffer,
		restFromLastTime?: any
	): {
		data: any;
		rest: any;
	};

	packageSeparator: string;
	mimeType: string;
}
