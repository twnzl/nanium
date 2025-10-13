export interface NaniumSerializer {
	serialize(obj: any): string | ArrayBuffer;

	serializePartial(obj: any): string | ArrayBuffer;

	deserialize(raw: string | ArrayBuffer | ArrayBufferView): any;

	deserializePartial(
		rawData: string | ArrayBuffer | ArrayBufferView,
		restFromLastTime?: any
	): {
		data: any;
		rest: any;
	};

	packageSeparator: string;
	mimeType: string;
}
