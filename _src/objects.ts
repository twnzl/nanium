import { ExecutionScope } from './interfaces/executionScope';
import { ServiceRequestInterceptor } from './interfaces/serviceRequestInterceptor';
import { Nanium } from './core';

export const responseTypeSymbol: symbol = Symbol.for('__Nanium__ResponseType__');
export const genericTypesSymbol: symbol = Symbol.for('__Nanium__GenericTypes__');
export const propertyInfoSymbol: symbol = Symbol.for('__Nanium__PropertyInfo__');
export const scopeProperty: string = 'scope';
export const skipInterceptorsProperty: string = 'skipInterceptors';

export class NaniumObject<T> {
	static strictDefault: boolean = false;

	constructor(data?: Partial<T>, genericTypes?: NaniumGenericTypeInfo, strict?: boolean) {
		NaniumObject.init(this, data, genericTypes, strict);
	}

	private static initObjectCore<T = any>(
		plain: any,
		constructorOrObject: (new (data?: Partial<T>) => any) | T,
		globalGenericTypes?: NaniumGenericTypeInfo,
		localGenericTypes?: LocalGenerics | ConstructorType,
		strict?: boolean
	): any {
		let constructor: ConstructorType;
		let result: T;
		if (typeof constructorOrObject === 'function') {
			constructor = constructorOrObject as ConstructorType;
			result = new constructor();
		} else {
			if (constructorOrObject) {
				result = constructorOrObject;
				constructor = (constructorOrObject as unknown as object).constructor as ConstructorType;
			}
		}

		// undefined or null
		if (plain === undefined || plain === null) {
			return plain;
		}

		// return plain object, if constructor is unknown
		if (!constructor) {
			return plain;
		}

		// get generic type info
		globalGenericTypes = globalGenericTypes ?? constructor[genericTypesSymbol];

		// array
		if (Array.isArray(plain)) {
			return plain.map(item => this.initObjectCore(item, constructor, globalGenericTypes, undefined, strict));
		}

		// simple Type or Date
		switch (constructor) {
			case Date:
				return new Date(plain);
			case Number:
				return parseFloat(plain);
			case Boolean:
				return plain === 'false' ? false : Boolean(plain).valueOf();
			case String:
				return plain;
		}

		// object
		if (constructor['naniumBufferInternalValueSymbol']) {
			// special case NaniumBuffer, if we copy from a real instance of NaniumBuffer the internal values must stay
			result = new constructor(plain[constructor['naniumBufferInternalValueSymbol']]);
		} else {
			result = result ?? new constructor();
		}

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
						if (!strict) {
							result[property] = plain[property];
						}
						continue;
					}
					if (c === Object && !pi.localGenerics) { // @Type(Object) - takes the whole object as it is, even in strict mode, because it is explicitly marked as Object/any
						result[property] = plain[property];
					} else if (c === Array) {
						if (!Array.isArray(plain[property])) {
							result[property] = [this.initObjectCore(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics, strict)];
						} else {
							result[property] = this.initObjectCore(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics, strict);
						}
					} else {
						result[property] = this.initObjectCore(plain[property], c as ConstructorType, globalGenericTypes, pi.localGenerics, strict);
					}
				} else {
					if (typeof localGenericTypes === 'function') { // indexer Properties
						if (Object.prototype.hasOwnProperty.call(plain, property)) {
							result[property] = this.initObjectCore(plain[property], localGenericTypes as ConstructorType, globalGenericTypes, undefined, strict);
						}
						// } else if (typeof plain[property] === 'object' && plain[property] !== null) {
						// 	if (!Array.isArray(plain[property]) || (plain[property].length && typeof plain[property][0] === 'object')) {
						// 		if (!strict) {
						// 			result[property] = plain[property];
						// 			Nanium.logger.warn(`NaniumObject: no type given for property ${property} of class ${constructor.name}`);
						// 		}
						// 	}
					} else {
						if (!strict) {
							result[property] = plain[property];
							if (constructor.name !== 'Object') {
								Nanium.logger.warn(`NaniumObject: no type given for property ${property} of class ${constructor.name}`);
							}
						}
					}
				}
			}
		}
		return result;
	}

	static init<T>(dst: T, src: object): void;
	static init<T>(dst: T, src: object, strict: boolean): void;
	static init<T>(dst: T, src: object, genericTypes: NaniumGenericTypeInfo): void;
	static init<T>(dst: T, src: object, genericTypes: NaniumGenericTypeInfo, strict: boolean): void;
	static init<T>(
		dst: T,
		src: object,
		genericTypesOrStrict?: NaniumGenericTypeInfo | boolean,
		strict?: boolean
	): void {
		let genericTypes: NaniumGenericTypeInfo;
		if (typeof genericTypesOrStrict === 'boolean') {
			strict = genericTypesOrStrict;
		} else {
			strict = strict !== undefined ? strict : this.strictDefault;
			genericTypes = genericTypesOrStrict;
		}
		NaniumObject.initObjectCore<T>(src, dst, genericTypes, undefined, strict);
	}

	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeId): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeId, strict: boolean): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeId, parentCtor: ConstructorType, strict?: boolean): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeId, genericTypes: NaniumGenericTypeInfo, strict?: boolean): T;
	static create<T>(
		src: Partial<T>,
		ctor: ConstructorOrGenericTypeId,
		parentConstructorOrGenericTypesInfoOrStrict?: ConstructorType | NaniumGenericTypeInfo | boolean,
		strict?: boolean,
	): T {
		if (typeof ctor === 'string') {
			return this.initObjectCore<T>(
				src,
				parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol] ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol][ctor] : undefined,
				parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol],
				undefined,
				strict);
		} else {
			strict = typeof parentConstructorOrGenericTypesInfoOrStrict === 'boolean'
				? parentConstructorOrGenericTypesInfoOrStrict
				: strict !== undefined ? strict : this.strictDefault;
			let globalGenericTypes: NaniumGenericTypeInfo;
			if (typeof parentConstructorOrGenericTypesInfoOrStrict !== 'boolean') {
				globalGenericTypes = typeof parentConstructorOrGenericTypesInfoOrStrict === 'function'
					? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol] ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol][ctor] : undefined
					: parentConstructorOrGenericTypesInfoOrStrict;
			}
			return this.initObjectCore<T>(
				src,
				ctor,
				globalGenericTypes,
				undefined,
				strict);
		}
	}

	static forEachProperty(obj: any, fn: (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => void) {
		const core = (obj: any, fn: (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => void, name: string[]) => {
			if (!obj) {
				return;
			}
			for (const prop of Object.keys(obj)) {
				if (Object.prototype.hasOwnProperty.call(obj, prop)) {
					fn([...name, prop], obj, obj.constructor[propertyInfoSymbol] ? obj.constructor[propertyInfoSymbol][prop] : undefined);
					if (!['string', 'function', 'number', 'boolean'].includes(typeof obj[prop])) {
						core(obj[prop], fn, [...name, prop]);
					}
				}
			}
		};

		core(obj, fn, []);
	}
}

export class NaniumPropertyInfo {
	[prop: string]: NaniumPropertyInfoCore;
}

export class NaniumPropertyInfoCore {
	constructor(
		public ctor: ConstructorType,
		public genericTypeId?: string,
		public localGenerics?: LocalGenerics | ConstructorType
	) {
	}
}

export class NaniumGenericTypeInfo {
	[prop: string]: ConstructorType;
}

export class NaniumRequestInfo {
	responseType?: ConstructorType = Object;
	genericTypes?: { [id: string]: ConstructorType };
	scope?: ExecutionScope = 'private';
	skipInterceptors?: boolean | string[] | { [scope in ExecutionScope]: boolean | string[]; } = false;
}

export class NaniumEventInfo {
	genericTypes?: { [id: string]: new() => any; };
	scope?: ExecutionScope = 'private';
	skipInterceptors?: boolean | (new() => ServiceRequestInterceptor<any>)[] | { [scope in ExecutionScope]: boolean | (new() => ServiceRequestInterceptor<any>)[]; } = false;
}

/**
 * Make type information for a property available at runtime.
 * @param clazzOrGenericTypeId If the type of the property is a generic Type, use a unique ID string for this Type. If it is not a generic Type, use the class/constructor. If it is, a dictionary use class Object.
 * @param generics If the property is not a generic Type, but it uses a generic Type (e.g. Stuff<T1, T2>), specify a dictionary with the IDs of the generic types as keys and the constructors as values
 */
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

export type ConstructorType<T = any> = (new (...data: any[]) => T);

export type ConstructorOrGenericTypeId = (ConstructorType | string);

export interface LocalGenerics {
	[genericTypeId: string]: ConstructorOrGenericTypeId;
}
