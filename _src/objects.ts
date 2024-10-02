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

	constructor(data?: Partial<T>, genericTypes?: NaniumGenericTypeInfo, strict?: boolean, cloneDeep?: boolean) {
		NaniumObject.init(this, data, genericTypes, strict, cloneDeep ?? true);
	}

	private static initObjectCore<T = any>(
		plain: any,
		constructorOrObject: (new (data?: Partial<T>) => any) | T,
		globalGenericTypes?: NaniumGenericTypeInfo,
		localGenericTypes?: LocalGenerics | ConstructorType | ConstructorGetter,
		strict?: boolean,
		deepClone?: boolean,
		plainParents: any[] = [],
	): any {
		let constructor: ConstructorType;
		let result: T;
		if (typeof constructorOrObject === 'function') {
			if (!this.isConstructor(constructorOrObject)) {
				if (!Array.isArray(plain)) {
					constructor = (constructorOrObject as Function)(plain, ...plainParents) as ConstructorType;
					result = new constructor();
				}
			} else {
				constructor = constructorOrObject as ConstructorType;
				result = new constructor();
			}
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
		if (!constructor && !Array.isArray(plain)) {
			return deepClone ? this.cloneDeep(plain) : plain;
		}

		// get generic type info
		if (constructor) {
			globalGenericTypes = globalGenericTypes ?? constructor[genericTypesSymbol];
		}

		// array
		if (Array.isArray(plain)) {
			return plain.map(item => this.initObjectCore(item, constructor ?? constructorOrObject, globalGenericTypes, undefined, strict, deepClone, plain));
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
			case AnySimple:
				return (
					['number', 'boolean', 'string', 'bigint'].includes(typeof plain)
						? plain
						: strict ? undefined : plain
				);
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
		let c: ConstructorOrGenericTypeIdOrFkt;
		for (const property in plain) {
			if (plain.hasOwnProperty(property)) {
				if (propertyInfo?.hasOwnProperty(property)) {
					pi = propertyInfo[property];
					c = pi.ctor ??
						(localGenericTypes ?? {})[pi.genericTypeId] ??
						(globalGenericTypes ? globalGenericTypes[pi.genericTypeId] : undefined);
					if (typeof c === 'function' && !this.isConstructor(c)) {
						c = (c as Function)(plain[property], plain, ...plainParents);
					}
					if (typeof c === 'string') {
						c = (localGenericTypes ?? {})[pi.genericTypeId] ?? globalGenericTypes[c];
					}
					if (c === undefined) {
						if (!strict) {
							result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
						}
						continue;
					}
					if (c === Object && !pi.localGenerics) { // @Type(Object) - takes the whole object as it is, even in strict mode, because it is explicitly marked as Object/any
						result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
					} else if (c === Array) {
						if (!Array.isArray(plain[property]) && plain[property] !== undefined && plain[property] !== null) {
							result[property] = [this.initObjectCore(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, ...plainParents])];
						} else {
							result[property] = this.initObjectCore(plain[property], pi.localGenerics as ConstructorType, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, ...plainParents]);
						}
					} else if (!this.isConstructor(c)) {
						result[property] = this.initObjectCore(plain[property], (c as Function)(plain, ...plainParents) as ConstructorType, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, plainParents]);
					} else {
						result[property] = this.initObjectCore(plain[property], c as ConstructorType, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, plainParents]);
					}
				} else {
					if (typeof localGenericTypes === 'function') { // indexer Properties
						if (!this.isConstructor(localGenericTypes)) {
							localGenericTypes = (localGenericTypes as Function)(plain[property], plain, ...plainParents);
						}
						if (Object.prototype.hasOwnProperty.call(plain, property)) {
							result[property] = this.initObjectCore(plain[property], localGenericTypes as ConstructorType, globalGenericTypes, undefined, strict, deepClone, [plain, ...plainParents]);
						}
						// } else if (typeof plain[property] === 'object' && plain[property] !== null) {
						// 	if (!Array.isArray(plain[property]) || (plain[property].length && typeof plain[property][0] === 'object')) {
						// 		if (!strict) {
						// 			result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
						// 			Nanium.logger.warn(`NaniumObject: no type given for property ${property} of class ${constructor.name}`);
						// 		}
						// 	}
					} else {
						if (!strict) {
							result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
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
	static init<T>(dst: T, src: object, genericTypes: NaniumGenericTypeInfo, strict: boolean, deepClone?: boolean): void;
	static init<T>(
		dst: T,
		src: object,
		genericTypesOrStrict?: NaniumGenericTypeInfo | boolean,
		strict?: boolean,
		deepClone?: boolean
	): void {
		let genericTypes: NaniumGenericTypeInfo;
		if (typeof genericTypesOrStrict === 'boolean') {
			strict = genericTypesOrStrict;
		} else {
			strict = strict !== undefined ? strict : this.strictDefault;
			genericTypes = genericTypesOrStrict;
		}
		NaniumObject.initObjectCore<T>(src, dst, genericTypes, undefined, strict, deepClone);
	}

	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, strict: boolean): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, parentCtor: ConstructorType, strict?: boolean, deepClone?: boolean): T;
	static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, genericTypes: NaniumGenericTypeInfo, strict?: boolean, deepClone?: boolean): T;
	static create<T>(
		src: Partial<T>,
		ctor: ConstructorOrGenericTypeIdOrFkt,
		parentConstructorOrGenericTypesInfoOrStrict?: ConstructorType | NaniumGenericTypeInfo | boolean,
		strict?: boolean,
		deepClone?: boolean,
	): T {
		if (typeof ctor === 'string') {
			return this.initObjectCore<T>(
				src,
				parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol] ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol][ctor] : undefined,
				parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol],
				undefined,
				strict,
				deepClone);
		} else {
			if (ctor && !this.isConstructor(ctor as Function)) {
				ctor = (ctor as Function)(src);
			}
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
				ctor as ConstructorType,
				globalGenericTypes,
				undefined,
				strict,
				deepClone);
		}
	}

	static isPropertyDefined(c: ConstructorType, prop: string): boolean {
		const info = c[propertyInfoSymbol];
		return info && (prop in info);
	}

	static forEachProperty(obj: any, fn: (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => void) {
		const core = (obj: any, fn: (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => void, name: string[]) => {
			if (!obj) {
				return;
			}
			for (const prop of Object.keys(obj)) {
				if (Object.prototype.hasOwnProperty.call(obj, prop)) {
					fn([...name, prop], obj, obj.constructor[propertyInfoSymbol] && obj.constructor[propertyInfoSymbol][prop]);
					if (!['string', 'function', 'number', 'boolean'].includes(typeof obj[prop])) {
						core(obj[prop], fn, [...name, prop]);
					}
				}
			}
		};

		core(obj, fn, []);
	}

	static traverseType(c: ConstructorType, fn: (name: string[], typeInfo?: NaniumPropertyInfoCore) => void, depth: number = 2) {
		const knownTypes: ConstructorType[] = [];

		const core = (name: string[], c: ConstructorType) => {
			if (!c[propertyInfoSymbol]) {
				return;
			}
			if (knownTypes.filter(t => t === c)?.length >= depth) {
				return;
			}
			knownTypes.push(c);
			const info: NaniumPropertyInfo = c[propertyInfoSymbol];
			for (const prop of Object.keys(info)) {
				fn([...name, prop], info[prop]);
				core([...name, prop], info[prop].ctor as ConstructorType);
			}
		};

		core([], c);
	}

	static getRequestInfo(request: ConstructorType): NaniumRequestInfo {
		const result = new NaniumRequestInfo();
		result.responseType = request[responseTypeSymbol];
		result.genericTypes = request[genericTypesSymbol];
		result.scope = request[scopeProperty];
		result.skipInterceptors = request[skipInterceptorsProperty];
		return result;
	}

	/**
	 * generate a list of JSON schemas using the Type() annotations of NaniumObject
	 * @param type constructor function for which the schemas schall be generated
	 * @param baseURI base URI for all generated schemas (the last part is the type name)
	 * @param knownSchemas already known Schemas
	 * @param fileMatch if set, the fileMatch property will be set to the main schema (the one for the given constructor function)
	 */
	static createJsonSchemas(type: ConstructorType, baseURI: string, knownSchemas: JSONSchema[] = [], fileMatch?: string[]): JSONSchema[] {
		const results: JSONSchema[] = [];
		if (!baseURI) {
			throw new Error('baseURI missing');
		}
		if (!baseURI.endsWith('/')) {
			baseURI += '/';
		}

		function trySetSimpleProperty(
			c: ConstructorType,
			info: NaniumPropertyInfoCore | undefined,
			name: string,
			result?: any,
		): boolean {
			if (c === AnySimple) {
				result[name] = {
					'type': ['number', 'string', 'boolean']
				};
			} else if (c === String || c === Number || c === Boolean || c === Date) {
				result[name] = { type: c.name.toLowerCase() };
			} else if (c === Array) {
				const schemaPart: any = { type: 'array' };
				if (info?.localGenerics?.name) {
					if (!trySetSimpleProperty(info.localGenerics as ConstructorType, info, 'items', schemaPart)) {
						createJsonSchema(info.localGenerics as ConstructorType);
						schemaPart.items = { $ref: baseURI + (info.localGenerics as ConstructorType).name + '.schema.json' };
					}
				}
				result[name] = schemaPart;
			} else if (c === Object || c === AnySimple) { // Object/Dictionary
				const schemaPart: any = { type: 'object' };
				if (info?.localGenerics !== Object && info?.localGenerics?.name) {
					if (!trySetSimpleProperty(info.localGenerics as ConstructorType, info, 'additionalProperties', schemaPart)) {
						schemaPart.patternProperties = {
							'^.*$': { type: 'object', $ref: baseURI + (info.localGenerics as ConstructorType).name + '.schema.json' }
						};
						createJsonSchema(info.localGenerics as ConstructorType);
					}
				}
				result[name] = schemaPart;
			} else if (c === undefined && info.genericTypeId) { // todo: generic
				result[name] = {};
			} else if (typeof c === 'function' && !c.name) { // todo: dynamic via getType function
				result[name] = {};
			} else {
				return false;
			}
			return true;
		}

		function createJsonSchema(c: ConstructorType, globalGenericTypes?: { [id: string]: ConstructorType }): void {

			// scheme for this type is already in results array
			const uri: string = baseURI + c.name + '.schema.json';
			if (results.some(s => s.uri === uri) || knownSchemas.some(s => s.uri === uri)) {
				return;
			}

			// new type
			else {
				const subSchema = {
					uri: baseURI + c.name + '.schema.json',
					schema: {
						type: 'object',
						properties: {}
					}
				};
				results.push(subSchema);
				for (const prop of Object.keys((c[propertyInfoSymbol]) ?? {})) {
					if (prop in c[propertyInfoSymbol]) {
						if (
							globalGenericTypes?.[c[propertyInfoSymbol][prop].genericTypeId] ||
							!trySetSimpleProperty(c[propertyInfoSymbol][prop].ctor, c[propertyInfoSymbol][prop], prop, subSchema.schema.properties)
						) {
							const ctor = c[propertyInfoSymbol][prop].ctor ??
								globalGenericTypes?.[c[propertyInfoSymbol][prop].genericTypeId];
							subSchema.schema.properties[prop] = { $ref: baseURI + ctor.name + '.schema.json' };
							createJsonSchema(ctor, globalGenericTypes);
						}
					}
				}
			}
		}

		createJsonSchema(type, NaniumObject.getRequestInfo(type)?.genericTypes);

		if (knownSchemas?.length) {
			knownSchemas.forEach(s => results.push(s));
		}

		if (fileMatch) {
			results[0].fileMatch = fileMatch;
		}

		return results;
	}

	private static cloneDeep(source: any): any {
		if (source === undefined) {
			return undefined;
		}
		if (source === null) {
			return null;
		}
		if (Array.isArray(source)) {
			const target = [];
			for (const item of source) {
				target.push(this.cloneDeep(item));
			}
			return target;
		} else if (source instanceof Date) {
			return new Date(source);
		} else if (typeof source === 'object') {
			const target = new source.constructor();
			for (const key of Object.keys(source)) {
				target[key] = this.cloneDeep(source[key]);
			}
			return target;
		} else {
			return source;
		}
	}

	// private static isConstructor(obj) {
	// 	return !!obj.prototype && !!obj.prototype.constructor.name;
	// }

	static isConstructor(f: any): boolean {
		try {
			new f();
		} catch (err) {
			return false;
		}
		return true;
	}
}

export class NaniumPropertyInfo {
	[prop: string]: NaniumPropertyInfoCore;
}

export class NaniumPropertyInfoCore {
	constructor(
		public ctor: ConstructorType | ConstructorGetter,
		public genericTypeId?: string,
		public localGenerics?: LocalGenerics | ConstructorType | ConstructorGetter
	) {
	}
}

export class NaniumGenericTypeInfo {
	[prop: string]: ConstructorType;
}

export class NaniumRequestInfo {
	responseType?: ConstructorType | (LocalGenerics | ConstructorType | ConstructorGetter)[] = Object;
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
 * @param first If the type of the property is a generic Type, use a unique ID string for this Type. If it is not a generic Type, use the class/constructor. If it is, a dictionary use class Object or Function that returns class objects (parent object is the parameter).
 * @param second If the property is not a generic Type, but it uses a generic Type (e.g. Stuff<T1, T2>), specify a dictionary with the IDs of the generic types as keys and the constructors as values
 */
export function Type(
	first: ConstructorOrGenericTypeIdOrFkt,
	second?: LocalGenerics | ConstructorType | ConstructorGetter
): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor[propertyInfoSymbol] = target.constructor[propertyInfoSymbol] ?? {};
		if (typeof first === 'string') {
			target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(undefined, first, second);
		} else {
			target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(first, undefined, second);
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

export type ConstructorGetter = ((...parents: Object[]) => ConstructorType);

export type ConstructorOrGenericTypeIdOrFkt = (ConstructorOrGenericTypeId | ConstructorGetter);

export class AnySimple {
}

export interface LocalGenerics {
	[genericTypeId: string]: ConstructorOrGenericTypeIdOrFkt;
}

export interface JSONSchemaCore {
	type?: string | string[];
	required?: string[];
	items?: JSONSchemaCore;
	properties?: { [key: string]: JSONSchemaCore };
	patternProperties?: { [key: string]: JSONSchemaCore };
	additionalProperties?: boolean | JSONSchemaCore;
	$ref?: string;
}

export interface JSONSchema {
	uri: string;
	schema: JSONSchemaCore;
	fileMatch?: string[];
}
