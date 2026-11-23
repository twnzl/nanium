import { NaniumLogger } from './interfaces/logger.js';
export const responseTypeSymbol = Symbol.for('__Nanium__ResponseType__');
export const genericTypesSymbol = Symbol.for('__Nanium__GenericTypes__');
export const propertyInfoSymbol = Symbol.for('__Nanium__PropertyInfo__');
export const streamTypeSymbol = Symbol.for('__Nanium__StreamType__');
export const scopeProperty = 'scope';
export const skipInterceptorsProperty = 'skipInterceptors';
export class NaniumObject {
    static { this.strictDefault = false; }
    static { this.checkedForFieldDefinition = new WeakSet(); }
    constructor(data, genericTypes, strict, cloneDeep) {
        NaniumObject.init(this, data, genericTypes, strict, cloneDeep ?? true);
        if (data && !NaniumObject.checkedForFieldDefinition.has(new.target)) {
            NaniumObject.checkFieldDefinition(this, new.target);
        }
    }
    /**
     * With useDefineForClassFields=true (default for target ES2022 or higher) the property declarations of subclasses
     * are initialized with undefined AFTER this base constructor has run, which wipes out all values that were just set.
     * Because the field initializers run synchronously after super() returns, the check has to be deferred.
     */
    static checkFieldDefinition(instance, ctor) {
        const propertyInfo = ctor[propertyInfoSymbol];
        const setProperties = Object.keys(propertyInfo ?? {}).filter(p => instance[p] !== undefined);
        if (!setProperties.length) {
            return;
        }
        NaniumObject.checkedForFieldDefinition.add(ctor);
        queueMicrotask(() => {
            if (setProperties.every(p => instance[p] === undefined)) {
                NaniumLogger.warn(`NaniumObject: all properties of class ${ctor.name} were reset to undefined after the NaniumObject constructor ran. ` +
                    'This happens if the compiler option "useDefineForClassFields" is true (default for target ES2022 or higher). ' +
                    'Please set "useDefineForClassFields": false in your tsconfig.json.');
            }
        });
    }
    static initObjectCore(plain, constructorOrObject, globalGenericTypes, localGenericTypes, strict, deepClone, plainParents = []) {
        let constructor;
        let result;
        if (typeof constructorOrObject === 'function') {
            if (!this.isConstructor(constructorOrObject)) {
                if (!Array.isArray(plain)) {
                    constructor = constructorOrObject(plain, ...plainParents);
                    result = new constructor();
                }
            }
            else {
                constructor = constructorOrObject;
                result = new constructor();
            }
        }
        else {
            if (constructorOrObject) {
                result = constructorOrObject;
                constructor = constructorOrObject.constructor;
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
                return (['number', 'boolean', 'string', 'bigint'].includes(typeof plain)
                    ? plain
                    : strict ? undefined : plain);
        }
        // object
        if (constructor['naniumBufferInternalValueSymbol']) {
            // special case NaniumBuffer, if we copy from a real instance of NaniumBuffer the internal values must stay
            result = new constructor(plain[constructor['naniumBufferInternalValueSymbol']]);
        }
        else {
            result = result ?? new constructor();
        }
        const propertyInfo = constructor[propertyInfoSymbol];
        let pi;
        let c;
        for (const property in plain) {
            if (plain.hasOwnProperty(property)) {
                if (propertyInfo?.hasOwnProperty(property)) {
                    pi = propertyInfo[property];
                    c = pi.ctor ??
                        (localGenericTypes ?? {})[pi.genericTypeId] ??
                        (globalGenericTypes ? globalGenericTypes[pi.genericTypeId] : undefined);
                    if (typeof c === 'function' && !this.isConstructor(c)) {
                        c = c(plain[property], plain, ...plainParents);
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
                    }
                    else if (c === Array) {
                        if (!Array.isArray(plain[property]) && plain[property] !== undefined && plain[property] !== null) {
                            result[property] = [this.initObjectCore(plain[property], pi.localGenerics, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, ...plainParents])];
                        }
                        else {
                            result[property] = this.initObjectCore(plain[property], pi.localGenerics, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, ...plainParents]);
                        }
                    }
                    else if (!this.isConstructor(c)) {
                        result[property] = this.initObjectCore(plain[property], c(plain, ...plainParents), globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, plainParents]);
                    }
                    else {
                        result[property] = this.initObjectCore(plain[property], c, globalGenericTypes, pi.localGenerics, strict, deepClone, [plain, plainParents]);
                    }
                }
                else {
                    if (typeof localGenericTypes === 'function') { // indexer Properties
                        if (!this.isConstructor(localGenericTypes)) {
                            localGenericTypes = localGenericTypes(plain[property], plain, ...plainParents);
                            result[property] = this.initObjectCore(plain[property], localGenericTypes, globalGenericTypes, undefined, strict, deepClone, [plain, ...plainParents]);
                        }
                        else {
                            if (plain.constructor === Object) {
                                result[property] = this.initObjectCore(plain[property], localGenericTypes, globalGenericTypes, undefined, strict, deepClone, [plain, ...plainParents]);
                            }
                            else if (!strict) {
                                result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
                            }
                        }
                    }
                    else {
                        if (!strict) {
                            result[property] = deepClone ? this.cloneDeep(plain[property]) : plain[property];
                            if (constructor.name !== 'Object') {
                                NaniumLogger.warn(`NaniumObject: no type given for property ${property} of class ${constructor.name}`);
                            }
                        }
                    }
                }
            }
        }
        return result;
    }
    static init(dst, src, genericTypesOrStrict, strict, deepClone) {
        let genericTypes;
        if (typeof genericTypesOrStrict === 'boolean') {
            strict = genericTypesOrStrict;
        }
        else {
            strict = strict !== undefined ? strict : this.strictDefault;
            genericTypes = genericTypesOrStrict;
        }
        NaniumObject.initObjectCore(src, dst, genericTypes, undefined, strict, deepClone);
    }
    static create(src, ctor, parentConstructorOrGenericTypesInfoOrStrict, strict, deepClone) {
        if (typeof ctor === 'string') {
            return this.initObjectCore(src, parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol] ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol][ctor] : undefined, parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol], undefined, strict, deepClone);
        }
        else {
            if (ctor && !this.isConstructor(ctor)) {
                ctor = ctor(src);
            }
            strict = typeof parentConstructorOrGenericTypesInfoOrStrict === 'boolean'
                ? parentConstructorOrGenericTypesInfoOrStrict
                : strict !== undefined ? strict : this.strictDefault;
            let globalGenericTypes;
            if (typeof parentConstructorOrGenericTypesInfoOrStrict !== 'boolean') {
                globalGenericTypes = typeof parentConstructorOrGenericTypesInfoOrStrict === 'function'
                    ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol] ? parentConstructorOrGenericTypesInfoOrStrict[genericTypesSymbol][ctor] : undefined
                    : parentConstructorOrGenericTypesInfoOrStrict;
            }
            return this.initObjectCore(src, ctor, globalGenericTypes, undefined, strict, deepClone);
        }
    }
    static isPropertyDefined(c, prop) {
        const info = c[propertyInfoSymbol];
        return info && (prop in info);
    }
    static forEachProperty(obj, fn) {
        const core = (obj, fn, name) => {
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
    static traverseType(c, fn, genericTypes, depth = 2) {
        const knownTypes = [];
        const core = (name, c) => {
            if (!c || !c[propertyInfoSymbol]) {
                return;
            }
            if (knownTypes.filter(t => t === c)?.length >= depth) {
                return;
            }
            knownTypes.push(c);
            const info = c[propertyInfoSymbol];
            for (const prop of Object.keys(info)) {
                fn([...name, prop], info[prop]);
                core([...name, prop], info[prop].ctor ?? genericTypes?.[info[prop].genericTypeId ?? '']);
            }
        };
        core([], c);
    }
    static getRequestInfo(request) {
        const result = new NaniumRequestInfo();
        result.responseType = request[responseTypeSymbol];
        result.genericTypes = request[genericTypesSymbol];
        result.scope = request[scopeProperty];
        result.skipInterceptors = request[skipInterceptorsProperty];
        return result;
    }
    /**
     * generate a list of JSON schemas using the Type() annotations of NaniumObject
     * @param type constructor function for which the schemas shall be generated
     * @param baseURI base URI for all generated schemas (the last part is the type name)
     * @param knownSchemas already known Schemas
     * @param fileMatch if set, the fileMatch property will be set to the main schema (the one for the given constructor function)
     */
    static createJsonSchemas(type, baseURI, knownSchemas = [], fileMatch) {
        const results = [];
        if (!baseURI) {
            throw new Error('baseURI missing');
        }
        if (!baseURI.endsWith('/')) {
            baseURI += '/';
        }
        function trySetSimpleProperty(c, info, name, result) {
            if (c === AnySimple) {
                result[name] = {
                    'type': ['number', 'string', 'boolean']
                };
            }
            else if (c === String || c === Number || c === Boolean || c === Date) {
                result[name] = { type: c.name.toLowerCase() };
            }
            else if (c === Array) {
                const schemaPart = { type: 'array' };
                if (info?.localGenerics?.name) {
                    if (!trySetSimpleProperty(info.localGenerics, info, 'items', schemaPart)) {
                        createJsonSchema(info.localGenerics);
                        schemaPart.items = { $ref: baseURI + info.localGenerics.name + '.schema.json' };
                    }
                }
                result[name] = schemaPart;
            }
            else if (c === Object || c === AnySimple) { // Object/Dictionary
                const schemaPart = { type: 'object' };
                if (info?.localGenerics !== Object && info?.localGenerics?.name) {
                    if (!trySetSimpleProperty(info.localGenerics, info, 'additionalProperties', schemaPart)) {
                        schemaPart.patternProperties = {
                            '^.*$': { type: 'object', $ref: baseURI + info.localGenerics.name + '.schema.json' }
                        };
                        createJsonSchema(info.localGenerics);
                    }
                }
                result[name] = schemaPart;
            }
            else if (c === undefined && info.genericTypeId) { // todo: generic
                result[name] = {};
            }
            else if (typeof c === 'function' && !c.name) { // todo: dynamic via getType function
                result[name] = {};
            }
            else {
                return false;
            }
            return true;
        }
        function createJsonSchema(c, globalGenericTypes) {
            // scheme for this type is already in results array
            const uri = baseURI + c.name + '.schema.json';
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
                        if (globalGenericTypes?.[c[propertyInfoSymbol][prop].genericTypeId] ||
                            !trySetSimpleProperty(c[propertyInfoSymbol][prop].ctor, c[propertyInfoSymbol][prop], prop, subSchema.schema.properties)) {
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
    static cloneDeep(source) {
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
        }
        else if (source instanceof Date) {
            return new Date(source);
        }
        else if (typeof source === 'object') {
            const target = new source.constructor();
            for (const key of Object.keys(source)) {
                target[key] = this.cloneDeep(source[key]);
            }
            return target;
        }
        else {
            return source;
        }
    }
    // private static isConstructor(obj) {
    // 	return !!obj.prototype && !!obj.prototype.constructor.name;
    // }
    static isConstructor(f) {
        try {
            new f();
        }
        catch (err) {
            return false;
        }
        return true;
    }
}
export class NaniumPropertyInfo {
}
export class NaniumPropertyInfoCore {
    constructor(ctor, genericTypeId, localGenerics) {
        this.ctor = ctor;
        this.genericTypeId = genericTypeId;
        this.localGenerics = localGenerics;
    }
}
export class NaniumGenericTypeInfo {
}
export class NaniumRequestInfo {
    constructor() {
        this.responseType = Object;
        this.scope = 'private';
        this.skipInterceptors = false;
    }
}
export class NaniumEventInfo {
    constructor() {
        this.scope = 'private';
        this.skipInterceptors = false;
    }
}
/**
 * Make type information for a property available at runtime.
 * @param first If the type of the property is a generic Type, use a unique ID string for this Type. If it is not a generic Type, use the class/constructor. If it is, a dictionary use class Object or Function that returns class objects (parent object is the parameter).
 * @param second If the property is not a generic Type, but it uses a generic Type (e.g. Stuff<T1, T2>), specify a dictionary with the IDs of the generic types as keys and the constructors as values
 */
export function Type(first, second) {
    return (target, propertyKey) => {
        target.constructor[propertyInfoSymbol] = target.constructor[propertyInfoSymbol] ?? {};
        if (typeof first === 'string') {
            target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(undefined, first, second);
        }
        else {
            target.constructor[propertyInfoSymbol][propertyKey] = new NaniumPropertyInfoCore(first, undefined, second);
        }
    };
}
export function RequestType(info) {
    return (target) => {
        target[responseTypeSymbol] = info.responseType;
        target[genericTypesSymbol] = info.genericTypes;
        target[scopeProperty] = target[scopeProperty] ?? info.scope;
        target[skipInterceptorsProperty] = target[skipInterceptorsProperty] ?? info.skipInterceptors;
    };
}
export function EventType(info) {
    return (target) => {
        target[genericTypesSymbol] = info.genericTypes;
        target[scopeProperty] = target[scopeProperty] ?? info.scope;
        target[skipInterceptorsProperty] = target[skipInterceptorsProperty] ?? info.skipInterceptors;
    };
}
export class AnySimple {
}
//# sourceMappingURL=objects.js.map