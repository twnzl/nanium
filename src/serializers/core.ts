import { ServiceExecutionScope } from '../interfaces/serviceExecutionScope';

export const responseTypeSymbol: symbol = Symbol.for('__Nanium__ResponseType__');
export const genericTypesSymbol: symbol = Symbol.for('__Nanium__GenericTypes__');
export const propertyInfoSymbol: symbol = Symbol.for('__Nanium__PropertyInfo__');
export const scopeProperty: string = 'scope';
export const skipInterceptorsProperty: string = 'scope';

export class NaniumPropertyInfo {
	[prop: string]: NaniumPropertyInfoCore;
}

export class NaniumPropertyInfoCore {
	constructor(
		public ctor: new (data?: any) => any,
		public genericTypeId?: string
	) {
	}
}

export class NaniumGenericTypeInfo {
	[prop: string]: new (data?: any) => any;
}

export class NaniumRequestInfo {
	responseType: new() => any;
	genericTypes?: {
		[id: string]: new() => any;
	};
	scope?: ServiceExecutionScope = 'private';
	skipInterceptors?: boolean | string[] | { [scope: string]: boolean | string[]; } = false;
}

export function Type(clazz: new () => any): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor[propertyInfoSymbol] = target.constructor[propertyInfoSymbol] ?? {};
		target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(clazz);
	};
}

export function GenericType(genericTypeId: string): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor[propertyInfoSymbol] = target.constructor[propertyInfoSymbol] ?? {};
		target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(undefined, genericTypeId);
	};
}

export function RequestType(info: NaniumRequestInfo): Function {
	return (target: new () => any) => {
		target[responseTypeSymbol] = info.responseType;
		target[genericTypesSymbol] = info.genericTypes;
		target[scopeProperty] = target[scopeProperty] ?? info.scope;
		target[skipInterceptorsProperty] = target[skipInterceptorsProperty] ?? info.skipInterceptors;
	};
}

export class NaniumSerializerCore {

	static plainToClass(plain: any, constructor: new () => any, genericTypes?: NaniumGenericTypeInfo): any {
		// undefined or null
		if (plain === undefined || plain === null) {
			return plain;
		}
		let result: any;

		// return plain object, if Request does not have the RequestType decorator set
		if (!constructor || (!genericTypes && !constructor[responseTypeSymbol])) {
			return plain;
		}

		// get generic type info
		genericTypes = genericTypes ?? constructor[genericTypesSymbol];

		// array
		if (Array.isArray(plain)) {
			result = [];
			for (const item of plain) {
				result.push(this.plainToClass(item, constructor, genericTypes));
			}
			return result;
		}

		// object
		result = new constructor();
		const propertyInfo: NaniumPropertyInfo = constructor[propertyInfoSymbol];
		let pi: NaniumPropertyInfoCore;
		let c: new (v?: any) => any;
		for (const property in plain) {
			if (plain.hasOwnProperty(property)) {
				if (propertyInfo?.hasOwnProperty(property)) {
					pi = propertyInfo[property];
					c = pi.ctor ?? genericTypes[pi.genericTypeId];
					// @ts-ignore
					if ([Date, Number, Boolean, String].includes(c)) {
						result[property] = new c(plain[property]);
					} else {
						result[property] = this.plainToClass(plain[property], c, genericTypes);
					}
				} else {
					if (typeof plain[property] === 'object' && plain[property] !== null) {
						if (!Array.isArray(plain[property]) || (plain[property].length && typeof plain[property][0] === 'object')) {
							console.log(`NaniumSerializerCore.plainToClass: no type given for property ${property} of class ${constructor.name}`);
						}
					}
					result[property] = plain[property];
				}
			}
		}
		return result;
	}
}
