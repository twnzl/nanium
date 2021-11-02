import { NocatSerializer } from '../interfaces/serializer';

export class NocatJsonSerializer implements NocatSerializer {
	deserialize(str: string): Promise<any> {
		return Promise.resolve(JSON.parse(str));
	}

	serialize(obj: any): Promise<string> {
		return Promise.resolve(JSON.stringify(obj));
	}
}
