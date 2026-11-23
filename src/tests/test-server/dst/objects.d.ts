import { ExecutionScope } from './interfaces/executionScope.js';
import { ServiceRequestInterceptor } from './interfaces/serviceRequestInterceptor.js';
export declare const responseTypeSymbol: symbol;
export declare const genericTypesSymbol: symbol;
export declare const propertyInfoSymbol: symbol;
export declare const streamTypeSymbol: symbol;
export declare const scopeProperty: string;
export declare const skipInterceptorsProperty: string;
export declare class NaniumObject<T> {
    static strictDefault: boolean;
    private static readonly checkedForFieldDefinition;
    constructor(data?: Partial<T>, genericTypes?: NaniumGenericTypeInfo, strict?: boolean, cloneDeep?: boolean);
    /**
     * With useDefineForClassFields=true (default for target ES2022 or higher) the property declarations of subclasses
     * are initialized with undefined AFTER this base constructor has run, which wipes out all values that were just set.
     * Because the field initializers run synchronously after super() returns, the check has to be deferred.
     */
    private static checkFieldDefinition;
    private static initObjectCore;
    static init<T>(dst: T, src: object): void;
    static init<T>(dst: T, src: object, strict: boolean): void;
    static init<T>(dst: T, src: object, genericTypes: NaniumGenericTypeInfo): void;
    static init<T>(dst: T, src: object, genericTypes: NaniumGenericTypeInfo, strict: boolean, deepClone?: boolean): void;
    static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt): T;
    static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, strict: boolean): T;
    static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, parentCtor: ConstructorType | undefined, strict?: boolean, deepClone?: boolean): T;
    static create<T>(src: Partial<T>, ctor: ConstructorOrGenericTypeIdOrFkt, genericTypes: NaniumGenericTypeInfo, strict?: boolean, deepClone?: boolean): T;
    static isPropertyDefined(c: ConstructorType, prop: string): boolean;
    static forEachProperty(obj: any, fn: (name: string[], parent?: object, typeInfo?: NaniumPropertyInfoCore) => void): void;
    static traverseType(c: ConstructorType, fn: (name: string[], typeInfo?: NaniumPropertyInfoCore) => void, genericTypes?: any, depth?: number): void;
    static getRequestInfo(request: ConstructorType): NaniumRequestInfo;
    /**
     * generate a list of JSON schemas using the Type() annotations of NaniumObject
     * @param type constructor function for which the schemas shall be generated
     * @param baseURI base URI for all generated schemas (the last part is the type name)
     * @param knownSchemas already known Schemas
     * @param fileMatch if set, the fileMatch property will be set to the main schema (the one for the given constructor function)
     */
    static createJsonSchemas(type: ConstructorType, baseURI: string, knownSchemas?: JSONSchema[], fileMatch?: string[]): JSONSchema[];
    private static cloneDeep;
    static isConstructor(f: any): boolean;
}
export declare class NaniumPropertyInfo {
    [prop: string]: NaniumPropertyInfoCore;
}
export declare class NaniumPropertyInfoCore {
    ctor: ConstructorType | ConstructorGetter;
    genericTypeId?: string;
    localGenerics?: LocalGenerics | ConstructorType | ConstructorGetter;
    constructor(ctor: ConstructorType | ConstructorGetter, genericTypeId?: string, localGenerics?: LocalGenerics | ConstructorType | ConstructorGetter);
}
export declare class NaniumGenericTypeInfo {
    [prop: string]: ConstructorType;
}
export declare class NaniumRequestInfo {
    responseType?: ConstructorType | (LocalGenerics | ConstructorType | ConstructorGetter)[];
    genericTypes?: {
        [id: string]: ConstructorType;
    };
    scope?: ExecutionScope;
    skipInterceptors?: boolean | string[] | {
        [scope in ExecutionScope]: boolean | string[];
    };
}
export declare class NaniumEventInfo {
    genericTypes?: {
        [id: string]: new () => any;
    };
    scope?: ExecutionScope;
    skipInterceptors?: boolean | (new () => ServiceRequestInterceptor<any>)[] | {
        [scope in ExecutionScope]: boolean | (new () => ServiceRequestInterceptor<any>)[];
    };
}
/**
 * Make type information for a property available at runtime.
 * @param first If the type of the property is a generic Type, use a unique ID string for this Type. If it is not a generic Type, use the class/constructor. If it is, a dictionary use class Object or Function that returns class objects (parent object is the parameter).
 * @param second If the property is not a generic Type, but it uses a generic Type (e.g. Stuff<T1, T2>), specify a dictionary with the IDs of the generic types as keys and the constructors as values
 */
export declare function Type(first: ConstructorOrGenericTypeIdOrFkt, second?: LocalGenerics | ConstructorType | ConstructorGetter): Function;
export declare function RequestType(info: NaniumRequestInfo): Function;
export declare function EventType(info: NaniumEventInfo): Function;
export type ConstructorType<T = any> = (new (...data: any[]) => T);
export type ConstructorOrGenericTypeId = (ConstructorType | string);
export type ConstructorGetter = ((...parents: object[]) => ConstructorType);
export type ConstructorOrGenericTypeIdOrFkt = (ConstructorOrGenericTypeId | ConstructorGetter);
export declare class AnySimple {
}
export interface LocalGenerics {
    [genericTypeId: string]: ConstructorOrGenericTypeIdOrFkt;
}
export interface JSONSchemaCore {
    type?: string | string[];
    required?: string[];
    items?: JSONSchemaCore;
    properties?: {
        [key: string]: JSONSchemaCore;
    };
    patternProperties?: {
        [key: string]: JSONSchemaCore;
    };
    additionalProperties?: boolean | JSONSchemaCore;
    $ref?: string;
}
export interface JSONSchema {
    uri: string;
    schema: JSONSchemaCore;
    fileMatch?: string[];
}
