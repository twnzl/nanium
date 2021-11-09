import { NocatSerializer } from '../interfaces/serializer';

export class NocatJsonSerializer implements NocatSerializer {
	// constructor(public usePlainObjects: boolean = false) {
	// }

	async deserialize(str: string): Promise<any> {
		return JSON.parse(str);
	}

	async serialize(obj: any): Promise<string> {
		// if (this.usePlainObjects) {
		return JSON.stringify(obj);
		// } else {
		//
		// }
	}

	// async toClass<T>(plain: any, objectClass: new () => any): Promise<T> {
	// 	return plainToClass(objectClass, plain, this.options);
	// }

	mimeType: string = 'application/json';
}
