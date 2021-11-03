export interface NocatSerializer {
	serialize(obj: any): Promise<string>;

	deserialize(str: string): Promise<any>;

	mimeType: string;
}
