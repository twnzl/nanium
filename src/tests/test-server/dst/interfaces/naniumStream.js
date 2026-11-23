var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ExtendedPromise, uuid } from '../helper.js';
import { NaniumObject, Type } from '../objects.js';
import { NaniumBuffer } from './naniumBuffer.js';
export class NaniumStream {
    #buffer = [];
    #promises = [];
    #ended = false;
    #failed = null;
    // isBinary(): boolean {
    // 	return NaniumBuffer.isNaniumBuffer(this[responseTypeSymbol]);
    // }
    static { this.naniumIsNaniumStreamSymbol = Symbol.for('NaniumStream_IsNaniumStreamSymbol'); }
    constructor(/*itemConstructor?: new (...data: any) => T, genericTypeInfo?: NaniumGenericTypeInfo,*/ id) {
        // this[responseTypeSymbol] = itemConstructor ?? NaniumBuffer;
        // this[genericTypesSymbol] = genericTypeInfo;
        this.id = id ?? uuid();
    }
    //#region sender/writer
    write(value) {
        if (this.#ended || this.#failed)
            return;
        // for (const value of values) {
        // If a consumer is waiting, resolve immediately
        const promise = this.#promises.shift();
        if (promise) {
            promise.resolve({ value, done: false });
        }
        else {
            // Otherwise buffer the chunk
            this.#buffer.push({ value });
        }
        // }
    }
    error(err) {
        if (this.#ended || this.#failed) {
            return;
        }
        this.#failed = err;
        while (this.#promises.length) {
            const promise = this.#promises.shift();
            promise?.reject(err);
        }
    }
    end() {
        if (this.#ended || this.#failed) {
            return;
        }
        this.#ended = true;
        // Flush any waiting consumers with done = true
        while (this.#promises.length) {
            const promise = this.#promises.shift();
            if (promise) {
                promise.resolve({ value: undefined, done: true });
            }
        }
    }
    //#endregion sender/writer
    //#region receiver/reader
    // AsyncIterable implementation
    [Symbol.asyncIterator]() {
        return {
            next: () => this.next()
        };
    }
    next() {
        // If there was an error, throw it on next()
        if (this.#failed) {
            return Promise.reject(this.#failed);
        }
        // If buffer has data, deliver immediately
        const chunk = this.#buffer.shift();
        if (chunk && "value" in chunk) {
            return Promise.resolve({ value: chunk.value, done: false });
        }
        // If stream ended and buffer is empty, signal done
        if (this.#ended) {
            return Promise.resolve({ value: undefined, done: true });
        }
        // Otherwise wait for data/end/error
        const promise = new ExtendedPromise();
        this.#promises.push(promise);
        return promise;
    }
    pipeTo(destination) {
        void (async () => {
            try {
                for await (const chunk of this) {
                    destination.write(chunk);
                }
                destination.end();
            }
            catch (err) {
                destination.error(err);
            }
        })();
    }
    async toPromise() {
        const objectList = [];
        const buffer = new NaniumBuffer();
        for await (const chunk of this) {
            if (chunk instanceof NaniumBuffer) {
                buffer.write(chunk);
            }
            else {
                objectList.push(chunk);
            }
        }
        return (objectList?.length ? objectList.flat(Infinity) : buffer);
    }
    //#endregion receiver/reader
    static forEachStream(obj, fn) {
        if (NaniumStream.isNaniumStream(obj?.constructor)) {
            fn(obj, undefined); // todo: item type with generic parameter
        }
        NaniumObject.forEachProperty(obj, (name, parent, typeInfo) => {
            if (NaniumStream.isNaniumStream(typeInfo?.ctor)) {
                const stream = parent[name[name.length - 1]];
                if (stream) {
                    fn(stream, typeInfo.localGenerics['T']);
                }
            }
        });
    }
    static isNaniumStream(objectOrConstructor) {
        const prop = 'naniumIsNaniumStreamSymbol';
        return objectOrConstructor?.[prop] != undefined ||
            objectOrConstructor?.constructor?.[prop] != undefined;
    }
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], NaniumStream.prototype, "id", void 0);
//# sourceMappingURL=naniumStream.js.map