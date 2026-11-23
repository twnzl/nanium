var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { NaniumObject, Type } from '../objects.js';
let uuidCounter = 0;
export class NaniumBuffer {
    static { this.naniumBufferInternalValueSymbol = Symbol.for('__Nanium__BufferInternalValueSymbol__'); }
    // small primitive writes (e.g. writeUInt16LE) are collected into this growing chunk
    // instead of pushing a separate tiny ArrayBuffer per call, to avoid huge part arrays
    // that would make concatenation (asUint8Array/asArrayBuffer) slow.
    static { this.pendingChunkSize = 65536; } // 64KB
    constructor(data, id) {
        this.readIndex = 0;
        this.pendingChunk = null;
        this.pendingView = null;
        this.pendingOffset = 0;
        this[NaniumBuffer.naniumBufferInternalValueSymbol] = [];
        this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + (++uuidCounter);
        if (data) {
            if (Array.isArray(data)) {
                for (const part of data) {
                    this.write(part);
                }
            }
            else {
                this.write(data);
            }
        }
        return this;
    }
    getLength(part) {
        return part === undefined ? 0 : (part.buffer?.length ??
            part.byteLength ??
            part.length ??
            part.size);
    }
    get length() {
        const lengths = this[NaniumBuffer.naniumBufferInternalValueSymbol].map(part => this.getLength(part));
        const partsLength = lengths?.length ? lengths.reduce((whole, next) => whole + next) : 0;
        return partsLength + this.pendingOffset;
    }
    // moves the bytes collected in the pending chunk (from small primitive writes) into the parts array as a single part
    flushPendingChunk() {
        if (this.pendingOffset > 0) {
            this[NaniumBuffer.naniumBufferInternalValueSymbol].push(this.pendingChunk.slice(0, this.pendingOffset));
            this.pendingChunk = null;
            this.pendingView = null;
            this.pendingOffset = 0;
        }
    }
    write(data) {
        if (data?.constructor && data?.constructor['naniumBufferInternalValueSymbol']) {
            data.flushPendingChunk();
            this.flushPendingChunk();
            let part;
            const length = data[NaniumBuffer.naniumBufferInternalValueSymbol].length;
            for (let i = 0; i < length; i++) {
                part = data[NaniumBuffer.naniumBufferInternalValueSymbol][i];
                this[NaniumBuffer.naniumBufferInternalValueSymbol].push(part);
            }
        }
        else {
            this.flushPendingChunk();
            if (data instanceof DataView) {
                data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            }
            this[NaniumBuffer.naniumBufferInternalValueSymbol].push(data);
        }
    }
    static async as(targetType, data) {
        if (data.constructor && data.constructor['naniumBufferInternalValueSymbol']) {
            return data.as(targetType);
        }
        else {
            return new NaniumBuffer(data).as(targetType);
        }
    }
    async as(targetType) {
        if (NaniumBuffer.isArrayBufferLike(targetType)) {
            return await this.asArrayBuffer();
        }
        const data = await this.asUint8Array();
        if (NaniumBuffer.isBlobLike(targetType)) {
            return new targetType([data]);
        }
        else if (NaniumBuffer.isBufferLike(targetType)) {
            return targetType['from'](data);
        }
        else { // any typed Array
            return new targetType(data.buffer, data.byteOffset, data.byteLength / targetType['BYTES_PER_ELEMENT']);
        }
    }
    async asUint8Array() {
        this.flushPendingChunk();
        const internalValues = this[NaniumBuffer.naniumBufferInternalValueSymbol];
        if (internalValues.length === 0) {
            return new Uint8Array(0);
        }
        if (internalValues.length === 1) {
            return this.convertSinglePartToUint8Array(internalValues[0]);
        }
        return this.concatenateMultiplePartsToUint8Array(internalValues);
    }
    async convertSinglePartToUint8Array(data) {
        if (NaniumBuffer.isArrayBufferLike(data)) {
            return new Uint8Array(data);
        }
        if (NaniumBuffer.isBlobLike(data)) {
            const arrayBuffer = await data.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        }
        if (NaniumBuffer.isTypedArrayLike(data) || NaniumBuffer.isBufferLike(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        throw new Error(`Unsupported data type: ${Object.prototype.toString.call(data)}`);
    }
    //#region isLike...
    static isBlobLike(objectOrConstructor) {
        if (!objectOrConstructor) {
            return false;
        }
        try {
            const obj = NaniumObject.isConstructor(objectOrConstructor) ? new objectOrConstructor() : objectOrConstructor;
            return typeof obj['arrayBuffer'] === 'function';
        }
        catch {
            return false;
        }
    }
    static isArrayBufferLike(objectOrConstructor) {
        if (!objectOrConstructor) {
            return false;
        }
        const ctor = NaniumObject.isConstructor(objectOrConstructor) ? objectOrConstructor : objectOrConstructor.constructor;
        return typeof ctor['isView'] === 'function';
    }
    static isBufferLike(objectOrConstructor) {
        if (!objectOrConstructor) {
            return false;
        }
        return (NaniumObject.isConstructor(objectOrConstructor)
            ? typeof objectOrConstructor['alloc'] === 'function'
            : typeof objectOrConstructor['readBigInt64BE'] === 'function');
    }
    static isTypedArrayLike(objectOrConstructor) {
        if (!objectOrConstructor) {
            return false;
        }
        const obj = NaniumObject.isConstructor(objectOrConstructor) ? new objectOrConstructor() : objectOrConstructor;
        return typeof obj['forEach'] === 'function' && !this.isBufferLike(objectOrConstructor);
    }
    //#endregion
    async concatenateMultiplePartsToUint8Array(internalValues) {
        const result = new Uint8Array(this.length);
        let offset = 0;
        for (const part of internalValues) {
            const { sourceBytes, bytesToCopy } = await this.preparePartForCopy(part);
            // Sicherheitscheck
            if (offset + bytesToCopy > result.length) {
                throw new Error(`Buffer overflow: trying to write ${bytesToCopy} bytes at offset ${offset}, but result has only ${result.length} bytes`);
            }
            result.set(sourceBytes, offset);
            offset += bytesToCopy;
        }
        return result;
    }
    async preparePartForCopy(part) {
        if (NaniumBuffer.isBlobLike(part)) {
            const arrayBuffer = await part.arrayBuffer();
            const sourceBytes = new Uint8Array(arrayBuffer);
            return { sourceBytes, bytesToCopy: sourceBytes.length };
        }
        if (NaniumBuffer.isTypedArrayLike(part) || NaniumBuffer.isBufferLike(part)) {
            const sourceBytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
            return { sourceBytes, bytesToCopy: part.byteLength };
        }
        if (NaniumBuffer.isArrayBufferLike(part)) {
            const sourceBytes = new Uint8Array(part);
            return { sourceBytes, bytesToCopy: part.byteLength };
        }
        throw new Error(`Unsupported data type: ${Object.prototype.toString.call(part)}`);
    }
    async asArrayBuffer() {
        const data = await this.asUint8Array();
        if (data.byteLength === data.buffer.byteLength) {
            return (await this.asUint8Array()).buffer;
        }
        else {
            return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }
    }
    clear() {
        this[NaniumBuffer.naniumBufferInternalValueSymbol] = [];
        this.pendingChunk = null;
        this.pendingView = null;
        this.pendingOffset = 0;
    }
    async asString(encoding = 'utf-8') {
        this.flushPendingChunk();
        const result = [];
        for await (const part of this[NaniumBuffer.naniumBufferInternalValueSymbol]) {
            if (!part) {
                continue;
            }
            try {
                if (NaniumBuffer.isBlobLike(part)) {
                    result.push(await part.text());
                }
                else if (typeof part === 'string') {
                    result.push(part);
                }
                else if (NaniumBuffer.isTypedArrayLike(part)) {
                    const uint8View = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
                    result.push(new TextDecoder(encoding).decode(uint8View));
                }
                else if (NaniumBuffer.isBufferLike(part)) {
                    const uint8View = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
                    result.push(new TextDecoder(encoding).decode(uint8View));
                }
                else if (NaniumBuffer.isArrayBufferLike(part)) {
                    result.push(new TextDecoder(encoding).decode(part));
                }
                else { // Fallback: try as ArrayBufferView
                    result.push(new TextDecoder(encoding).decode(part));
                }
            }
            catch (error) {
                throw new Error(`Failed to decode part to string: ${error.message}. Part type: ${Object.prototype.toString.call(part)}`);
            }
        }
        return result.join('');
    }
    slice(start, end) {
        this.flushPendingChunk();
        const result = new NaniumBuffer();
        const data = this[NaniumBuffer.naniumBufferInternalValueSymbol];
        if (end === undefined) {
            end = this.length;
        }
        else if (end < 0) {
            end = this.length + end;
        }
        let i = 0;
        let l;
        while (data.length > i) {
            l = this.getLength(data[i]);
            if (start < l) {
                break;
            }
            start -= l;
            end -= l;
            i++;
        }
        // add rest of current part zu result
        if (end > l && start > 0) {
            if (data[i].BYTES_PER_ELEMENT > 1) {
                result.write(data[i].buffer.slice(start));
            }
            else {
                result.write(data[i].subarray ? data[i].subarray(start) : data[i].slice(start));
            }
            end -= l;
            i++;
            l = this.getLength(data[i]);
            start = 0;
        }
        // add all parts between start and end
        while (i < data.length && end > l) {
            result.write(data[i]);
            i++;
            end -= l;
            l = this.getLength(data[i]);
        }
        // add part of last part
        if (i < data.length && end > 0) {
            if (data[i].BYTES_PER_ELEMENT > 1) {
                result.write(data[i].buffer.slice(0, end));
            }
            else {
                result.write(data[i].subarray ? data[i].subarray(start, end) : data[i].slice(start, end));
            }
        }
        return result;
    }
    async asReadable() {
        return NaniumBufferReadable.from(this);
    }
    //#region write methods
    writeString(text) {
        this.write(new TextEncoder().encode(text));
        return this;
    }
    ;
    writeCore(n, type, bits, endianness = 'LE') {
        const byteCount = bits / 8;
        if (!this.pendingChunk || this.pendingOffset + byteCount > NaniumBuffer.pendingChunkSize) {
            this.flushPendingChunk();
            this.pendingChunk = new ArrayBuffer(Math.max(NaniumBuffer.pendingChunkSize, byteCount));
            this.pendingView = new DataView(this.pendingChunk);
        }
        this.pendingView['set' + type + bits](this.pendingOffset, n, endianness === 'LE');
        this.pendingOffset += byteCount;
    }
    writeInt8(n) {
        this.writeCore(n, 'Int', 8, 'LE');
        return this;
    }
    writeUInt8(n) {
        this.writeCore(n, 'Uint', 8, 'LE');
        return this;
    }
    writeInt16LE(n) {
        this.writeCore(n, 'Int', 16, 'LE');
        return this;
    }
    writeUInt16LE(n) {
        this.writeCore(n, 'Uint', 16, 'LE');
        return this;
    }
    writeInt16BE(n) {
        this.writeCore(n, 'Int', 16, 'BE');
        return this;
    }
    writeUInt16BE(n) {
        this.writeCore(n, 'Uint', 16, 'BE');
        return this;
    }
    writeInt32LE(n) {
        this.writeCore(n, 'Int', 32, 'LE');
        return this;
    }
    writeUInt32LE(n) {
        this.writeCore(n, 'Uint', 32, 'LE');
        return this;
    }
    writeInt32BE(n) {
        this.writeCore(n, 'Int', 32, 'BE');
        return this;
    }
    writeUInt32BE(n) {
        this.writeCore(n, 'Uint', 32, 'BE');
        return this;
    }
    writeInt64LE(n) {
        this.writeCore(n, 'BigInt', 64, 'LE');
        return this;
    }
    writeUInt64LE(n) {
        this.writeCore(n, 'BigUint', 64, 'LE');
        return this;
    }
    writeInt64BE(n) {
        this.writeCore(n, 'BigInt', 64, 'BE');
        return this;
    }
    writeUInt64BE(n) {
        this.writeCore(n, 'BigUint', 64, 'BE');
        return this;
    }
    writeFloat32LE(n) {
        this.writeCore(n, 'Float', 32, 'LE');
        return this;
    }
    writeFloat64LE(n) {
        this.writeCore(n, 'Float', 64, 'LE');
        return this;
    }
    writeFloat32BE(n) {
        this.writeCore(n, 'Float', 32, 'BE');
        return this;
    }
    writeFloat64BE(n) {
        this.writeCore(n, 'Float', 64, 'BE');
        return this;
    }
    //#endregion write Methods
    static isNaniumBuffer(objectOrConstructor) {
        return objectOrConstructor?.['naniumBufferInternalValueSymbol'] != undefined ||
            objectOrConstructor?.constructor?.['naniumBufferInternalValueSymbol'] != undefined;
    }
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], NaniumBuffer.prototype, "id", void 0);
__decorate([
    Type(Number),
    __metadata("design:type", Number)
], NaniumBuffer.prototype, "readIndex", void 0);
export class NaniumBufferReadable {
    get length() {
        return this.data.byteLength;
    }
    ;
    get eof() {
        return this.readIndex >= this.data.byteLength;
    }
    constructor(data) {
        this.data = data;
        this.readIndex = 0;
    }
    static async from(...data) {
        let nb;
        if (data.length === 1 && data[0] instanceof NaniumBuffer) {
            nb = data[0];
        }
        else {
            nb = new NaniumBuffer(data);
        }
        ;
        return new NaniumBufferReadable(new DataView(await nb.asArrayBuffer()));
    }
    //#region Read Methods
    startSequentialReadingAt(idx) {
        this.readIndex = idx ?? 0;
    }
    readString(length, startIdx = this.readIndex, encoding = 'utf-8') {
        const stringView = new Uint8Array(this.data.buffer, this.data.byteOffset + startIdx, length);
        this.readIndex = startIdx + length;
        return new TextDecoder(encoding).decode(stringView);
    }
    ;
    readFloat32LE(idx = this.readIndex) {
        this.readIndex = idx + 4;
        return this.data.getFloat32(idx, true);
    }
    readFloat64LE(idx = this.readIndex) {
        this.readIndex = idx + 8;
        return this.data.getFloat64(idx, true);
    }
    readInt8(idx = this.readIndex) {
        this.readIndex = idx + 1;
        return this.data.getInt8(idx);
    }
    readInt16LE(idx = this.readIndex) {
        this.readIndex = idx + 2;
        return this.data.getInt16(idx, true);
    }
    readInt32LE(idx = this.readIndex) {
        this.readIndex = idx + 4;
        return this.data.getInt32(idx, true);
    }
    readInt64LE(idx = this.readIndex) {
        this.readIndex = idx + 8;
        return this.data.getBigInt64(idx, true);
    }
    readUInt8(idx = this.readIndex) {
        this.readIndex = idx + 1;
        return this.data.getUint8(idx);
    }
    readUInt16LE(idx = this.readIndex) {
        this.readIndex = idx + 2;
        return this.data.getUint16(idx, true);
    }
    readUInt32LE(idx = this.readIndex) {
        this.readIndex = idx + 4;
        return this.data.getUint32(idx, true);
    }
    readUInt64LE(idx = this.readIndex) {
        this.readIndex = idx + 8;
        return this.data.getBigUint64(idx, true);
    }
    // BE
    readFloat32BE(idx) {
        this.readIndex = idx + 4;
        return this.data.getFloat32(idx, false);
    }
    readFloat64BE(idx) {
        this.readIndex = idx + 8;
        return this.data.getFloat64(idx, false);
    }
    readInt16BE(idx = this.readIndex) {
        this.readIndex = idx + 2;
        return this.data.getInt16(idx, false);
    }
    readInt32BE(idx = this.readIndex) {
        this.readIndex = idx + 4;
        return this.data.getInt16(idx, false);
    }
    readInt64BE(idx) {
        this.readIndex = idx + 8;
        return this.data.getBigInt64(idx, false);
    }
    readUInt16BE(idx = this.readIndex) {
        this.readIndex = idx + 2;
        return this.data.getUint16(idx, false);
    }
    readUInt32BE(idx = this.readIndex) {
        this.readIndex = idx + 4;
        return this.data.getUint32(idx, false);
    }
    readUInt64BE(idx) {
        this.readIndex = idx + 8;
        return this.data.getBigUint64(idx, false);
    }
}
//# sourceMappingURL=naniumBuffer.js.map