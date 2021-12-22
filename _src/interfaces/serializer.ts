export interface NaniumSerializer {
	serialize(obj: any): Promise<string>;

	deserialize(str: string): Promise<any>;

	mimeType: string;
}
