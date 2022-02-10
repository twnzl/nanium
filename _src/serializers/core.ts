import { ExecutionScope } from '../interfaces/executionScope';
import { ServiceRequestInterceptor } from '../interfaces/serviceRequestInterceptor';

export const responseTypeSymbol: symbol = Symbol.for('__Nanium__ResponseType__');
export const genericTypesSymbol: symbol = Symbol.for('__Nanium__GenericTypes__');
export const propertyInfoSymbol: symbol = Symbol.for('__Nanium__PropertyInfo__');
export const scopeProperty: string = 'scope';
export const skipInterceptorsProperty: string = 'skipInterceptors';

export class NaniumPropertyInfo {
	[prop: string]: NaniumPropertyInfoCore;
}

export class NaniumPropertyInfoCore {
	constructor(
		public ctor: new (data?: any) => any,
		public genericTypeId?: string,
		public localGenerics?: LocalGenerics | ConstructorType
	) {
	}
}

export class NaniumGenericTypeInfo {
	[prop: string]: new (data?: any) => any;
}

export class NaniumRequestInfo {
	responseType: new() => any;
	genericTypes?: { [id: string]: new() => any; };
	scope?: ExecutionScope = 'private';
	skipInterceptors?: boolean | (new() => ServiceRequestInterceptor<any>)[] | { [scope in ExecutionScope]: boolean | (new() => ServiceRequestInterceptor<any>)[]; } = false;
}

export class NaniumEventInfo {
	genericTypes?: { [id: string]: new() => any; };
	scope?: ExecutionScope = 'private';
	skipInterceptors?: boolean | (new() => ServiceRequestInterceptor<any>)[] | { [scope in ExecutionScope]: boolean | (new() => ServiceRequestInterceptor<any>)[]; } = false;
}

export function Type(clazzOrGenericTypeId: ConstructorOrGenericTypeId, generics?: LocalGenerics | ConstructorType): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor[propertyInfoSymbol] = target.constructor[propertyInfoSymbol] ?? {};
		if (typeof clazzOrGenericTypeId === 'string') {
			target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(undefined, clazzOrGenericTypeId, generics);
		} else {
			target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(clazzOrGenericTypeId, undefined, generics);
		}
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

export function EventType(info: NaniumEventInfo): Function {
	return (target: new () => any) => {
		target[genericTypesSymbol] = info.genericTypes;
		target[scopeProperty] = target[scopeProperty] ?? info.scope;
		target[skipInterceptorsProperty] = target[skipInterceptorsProperty] ?? info.skipInterceptors;
	};
}

export class NaniumSerializerCore {

	static plainToClass(plain: any, constructor: new (data?: any) => any, globalGenericTypes?: NaniumGenericTypeInfo, localGenericTypes?: LocalGenerics | ConstructorType): any {
		// undefined or null
		if (plain === undefined || plain === null) {
			return plain;
		}
		let result: any;

		// return plain object, if constructor is unknown
		if (!constructor) {
			return plain;
		}

		// get generic type info
		globalGenericTypes = globalGenericTypes ?? constructor[genericTypesSymbol];

		// array
		if (Array.isArray(plain)) {
			return plain.map(item => this.plainToClass(item, constructor, globalGenericTypes));
		}

		// simple Type or Date
		switch (constructor) {
			case Date:
				return new Date(plain);
			case Number:
				return parseFloat(plain);
			case Boolean:
				return plain === 'true' || plain === true;
			case String:
				return plain;
		}

		// object
		result = new constructor();
		const propertyInfo: NaniumPropertyInfo = constructor[propertyInfoSymbol];
		let pi: NaniumPropertyInfoCore;
		let c: ConstructorOrGenericTypeId;
		for (const property in plain) {
			if (plain.hasOwnProperty(property)) {
				if (propertyInfo?.hasOwnProperty(property)) {
					pi = propertyInfo[property];
					c = pi.ctor ??
						(localGenericTypes ?? {})[pi.genericTypeId] ??
						(globalGenericTypes ? globalGenericTypes[pi.genericTypeId] : undefined);
					if (typeof c === 'string') {
						c = (localGenericTypes ?? {})[pi.genericTypeId] ?? globalGenericTypes[c];
					}
					if (c === undefined) {
						return plain;
					}
					if (c === Array) {
						if (!Array.isArray(plain[property])) {
							result[property] = [this.plainToClass(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics)];
						} else {
							result[property] = this.plainToClass(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics);
						}
					} else {
						result[property] = this.plainToClass(plain[property], c as ConstructorType, globalGenericTypes, pi.localGenerics);
					}
				} else {
					//todo: if localgenerics are given use the first Element as Constructor for all unspecified properties - it would be the type of an indexer property
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

export type ConstructorType = (new (data?: any) => any);

export type ConstructorOrGenericTypeId = (ConstructorType | string);

export interface LocalGenerics {
	[genericTypeId: string]: ConstructorOrGenericTypeId;
}
