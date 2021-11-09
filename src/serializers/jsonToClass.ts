import { NocatSerializer } from '../interfaces/serializer';

export class NocatJsonToClassSerializer implements NocatSerializer {

	async deserialize(str: string): Promise<any> {
		return JSON.parse(str);
	}

	async serialize(obj: any): Promise<string> {
		return JSON.stringify(obj);
	}

	async toClass(plain: any, constructor: new () => any, genericTypes?: NocatGenericTypeInfo): Promise<any> {
		// undefined or null
		if (plain === undefined || plain === null) {
			return plain;
		}
		let result: any;

		// get generic type info
		genericTypes = genericTypes ?? constructor['__genericTypes__'];

		// array
		if (Array.isArray(plain)) {
			result = [];
			for (const item of plain) {
				result.push(await this.toClass(item, constructor, genericTypes));
			}
			return result;
		}

		// object
		result = new constructor();
		const propertyInfo: NocatPropertyInfo = constructor['__propertyInfo__'];
		let pi: NocatPropertyInfoCore;
		let c: new () => any;
		for (const property in plain) {
			if (plain.hasOwnProperty(property)) {
				if (propertyInfo?.hasOwnProperty(property)) {
					pi = propertyInfo[property];
					c = pi.ctor ?? genericTypes[pi.genericTypeId];
					if (c === Date) {
						result[property] = new Date(plain[property]);
					} else {
						result[property] = await this.toClass(plain[property], c, genericTypes);
					}
				} else {
					if (typeof plain[property] === 'object') {
						if (!Array.isArray(plain[property]) || (plain[property].length && typeof plain[property][0] === 'object')) {
							throw new Error(`deserialization not possible: no type given for property ${property} of class ${constructor.name}`);
						}
					}
					result[property] = plain[property];
				}
			}
		}
		return result;
	}

	mimeType: string = 'application/json';
}

export class NocatPropertyInfo {
	[prop: string]: NocatPropertyInfoCore;
}

export class NocatPropertyInfoCore {
	constructor(
		public ctor: new (data?: any) => any,
		public genericTypeId?: string
	) {
	}
}

export class NocatGenericTypeInfo {
	[prop: string]: new (data?: any) => any;
}

export class NocatRequestInfo {
	responseType: new() => any;
	genericTypes?: {
		[id: string]: new() => any;
	};
}
