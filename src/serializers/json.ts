import { NaniumSerializer } from '../interfaces/serializer';

export class NaniumJsonSerializer implements NaniumSerializer {
	async deserialize(str: string): Promise<any> {
		try {
			return JSON.parse(str);
		} catch (e) {
			throw new Error('NaniumJsonSerializer: error while deserializing: "' + str + '"');
		}
	}

	async serialize(obj: any): Promise<string> {
		return JSON.stringify(obj);
	}

	mimeType: string = 'application/json';
}
