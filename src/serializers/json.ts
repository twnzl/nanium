import { NocatSerializer } from '../interfaces/serializer';

export class NocatJsonSerializer implements NocatSerializer {
	async deserialize(str: string): Promise<any> {
		return JSON.parse(str);
	}

	async serialize(obj: any): Promise<string> {
		return JSON.stringify(obj);
	}

	mimeType: string = 'application/json';
}
