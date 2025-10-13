import { ConstructorType, NaniumObject, Type } from '../objects';

let uuidCounter: number = 0;

export class NaniumBuffer {
	@Type(String) id: string;
	private static naniumBufferInternalValueSymbol: symbol = Symbol.for('__Nanium__BufferInternalValueSymbol__');

	private readIndex: number = 0;

	constructor(data?: DataSource | DataSource[], id?: string) {
		this[NaniumBuffer.naniumBufferInternalValueSymbol] = [];
		this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + (++uuidCounter);
		if (data) {
			if (Array.isArray(data)) {
				for (const part of data) {
					this.write(part);
				}
			} else {
				this.write(data as DataSource);
			}
		}
		return this;
	}

	private getLength(part): number {
		return part === undefined ? 0 : (
			part.buffer?.length ??
			(part as ArrayBuffer).byteLength ??
			(part as any).length ??
			(part as Blob).size
		);
	}

	get length(): number {
		const lengths = this[NaniumBuffer.naniumBufferInternalValueSymbol].map(part => this.getLength(part));
		if (lengths?.length) {
			return lengths.reduce((whole, next) => whole + next);
		} else {
			return 0;
		}
	}

	write(data: DataSource) {
		if (data?.constructor && data?.constructor['naniumBufferInternalValueSymbol']) {
			let part: any;
			const length = data[NaniumBuffer.naniumBufferInternalValueSymbol].length;
			for (let i = 0; i < length; i++) {
				part = data[NaniumBuffer.naniumBufferInternalValueSymbol][i];
				this[NaniumBuffer.naniumBufferInternalValueSymbol].push(part);
			}
		} else {
			if (data instanceof DataView) {
				data = new Uint8Array(
					data.buffer,
					data.byteOffset,
					data.byteLength
				);
			}
			this[NaniumBuffer.naniumBufferInternalValueSymbol].push(data);
		}
	}

	static async as<T>(targetType: new (first?: any, second?: any, third?: any) => T, data: DataSource): Promise<T> {
		if (data.constructor && data.constructor['naniumBufferInternalValueSymbol']) {
			return (data as NaniumBuffer).as(targetType);
		} else {
			return new NaniumBuffer(data).as(targetType);
		}
	}

	async as<T>(targetType: new (first?: any, second?: any, third?: any) => T): Promise<T> {
		if (this.isArrayBufferLike(targetType)) {
			return await this.asArrayBuffer() as unknown as T;
		}
		const data = await this.asUint8Array();
		if (this.isBlobLike(targetType)) {
			return new targetType([data]);
		} else if (this.isBufferLike(targetType)) {
			return targetType['from'](data);
		} else { // any typed Array
			return new targetType(data.buffer, data.byteOffset, data.byteLength / targetType['BYTES_PER_ELEMENT']);
		}
	}

	private isBlobLike(objectOrConstructor: any) {
		if (!objectOrConstructor) {
			return false;
		}
		try {
			const obj = NaniumObject.isConstructor(objectOrConstructor) ? new objectOrConstructor() : objectOrConstructor;
			return typeof obj['arrayBuffer'] === 'function';
		} catch {
			return false;
		}
	}

	private isArrayBufferLike(objectOrConstructor: any) {
		if (!objectOrConstructor) {
			return false;
		}
		const ctor = NaniumObject.isConstructor(objectOrConstructor) ? objectOrConstructor : objectOrConstructor.constructor;
		return typeof ctor['isView'] === 'function';
	}

	private isBufferLike(objectOrConstructor: any) {
		if (!objectOrConstructor) {
			return false;
		}
		return (
			NaniumObject.isConstructor(objectOrConstructor)
				? typeof objectOrConstructor['alloc'] === 'function'
				: typeof objectOrConstructor['readBigInt64BE'] === 'function'
		);
	}

	private isTypedArrayLike(objectOrConstructor: any) {
		if (!objectOrConstructor) {
			return false;
		}
		const obj = NaniumObject.isConstructor(objectOrConstructor) ? new objectOrConstructor() : objectOrConstructor;
		return typeof obj['forEach'] === 'function' && !this.isBufferLike(objectOrConstructor);
	}

	async asUint8Array(): Promise<Uint8Array> {
		const internalValues = this[NaniumBuffer.naniumBufferInternalValueSymbol];
		if (internalValues.length === 0) {
			return new Uint8Array(0);
		}
		if (internalValues.length === 1) {
			return this.convertSinglePartToUint8Array(internalValues[0]);
		}
		return this.concatenateMultiplePartsToUint8Array(internalValues);
	}

	private async convertSinglePartToUint8Array(data: any): Promise<Uint8Array> {
		if (this.isArrayBufferLike(data)) {
			return new Uint8Array(data);
		}
		if (this.isBlobLike(data)) {
			const arrayBuffer = await data.arrayBuffer();
			return new Uint8Array(arrayBuffer);
		}
		if (this.isTypedArrayLike(data) || this.isBufferLike(data)) {
			return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
		}
		throw new Error(`Unsupported data type: ${Object.prototype.toString.call(data)}`);
	}

	private async concatenateMultiplePartsToUint8Array(internalValues: any[]): Promise<Uint8Array> {
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

	private async preparePartForCopy(part: any): Promise<{ sourceBytes: Uint8Array, bytesToCopy: number }> {
		if (this.isBlobLike(part)) {
			const arrayBuffer = await part.arrayBuffer();
			const sourceBytes = new Uint8Array(arrayBuffer);
			return { sourceBytes, bytesToCopy: sourceBytes.length };
		}
		if (this.isTypedArrayLike(part) || this.isBufferLike(part)) {
			const sourceBytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
			return { sourceBytes, bytesToCopy: part.byteLength };
		}
		if (this.isArrayBufferLike(part)) {
			const sourceBytes = new Uint8Array(part);
			return { sourceBytes, bytesToCopy: part.byteLength };
		}
		throw new Error(`Unsupported data type: ${Object.prototype.toString.call(part)}`);
	}

	async asArrayBuffer(): Promise<ArrayBufferLike> {
		const data = await this.asUint8Array();
		if (data.byteLength === data.buffer.byteLength) {
			return (await this.asUint8Array()).buffer;
		} else {
			return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
		}
	}

	clear() {
		this[NaniumBuffer.naniumBufferInternalValueSymbol] = [];
	}

	async asString(encoding: string = 'utf-8'): Promise<string> {
		const result: string[] = [];

		for await (const part of this[NaniumBuffer.naniumBufferInternalValueSymbol]) {
			if (!part) {
				continue;
			}

			try {
				if (this.isBlobLike(part)) {
					result.push(await part.text());
				} else if (typeof part === 'string') {
					result.push(part);
				} else if (this.isTypedArrayLike(part)) {
					const uint8View = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
					result.push(new TextDecoder(encoding).decode(uint8View));
				} else if (this.isBufferLike(part)) {
					const uint8View = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
					result.push(new TextDecoder(encoding).decode(uint8View));
				} else if (this.isArrayBufferLike(part)) {
					result.push(new TextDecoder(encoding).decode(part));
				} else { // Fallback: try as ArrayBufferView
					result.push(new TextDecoder(encoding).decode(part));
				}
			} catch (error) {
				throw new Error(`Failed to decode part to string: ${error.message}. Part type: ${Object.prototype.toString.call(part)}`);
			}
		}

		return result.join('');
	}

	slice(start: number, end?: number): NaniumBuffer {
		const result = new NaniumBuffer();
		const data = this[NaniumBuffer.naniumBufferInternalValueSymbol];
		if (end === undefined) {
			end = this.length;
		} else if (end < 0) {
			end = this.length + end;
		}
		let i: number = 0;
		let l: number;
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
			} else {
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
			} else {
				result.write(data[i].subarray ? data[i].subarray(start, end) : data[i].slice(start, end));
			}
		}

		return result;
	}

	async asReadable(): Promise<NaniumBufferReadable> {
		return NaniumBufferReadable.from(this);
	}


	//#region write methods
	writeString(text: string): NaniumBuffer {
		this.write(new TextEncoder().encode(text));
		return this;
	};

	writeCore(n: number, type: 'Int' | 'Float', bits: 8 | 16 | 32 | 64, endianness: 'LE' | 'BE' = 'LE'): void {
		const buffer = new ArrayBuffer(bits / 8);
		new DataView(buffer)['set' + type + bits](0, n, endianness === 'LE');
		this[NaniumBuffer.naniumBufferInternalValueSymbol].push(buffer);
	}

	writeInt8(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 8, 'LE');
		return this;
	}

	writeInt16LE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 16, 'LE');
		return this;
	}

	writeInt16BE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 16, 'BE');
		return this;
	}

	writeInt32LE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 32, 'LE');
		return this;
	}

	writeInt32BE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 32, 'BE');
		return this;
	}

	writeInt64LE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 64, 'LE');
		return this;
	}

	writeInt64BE(n: number): NaniumBuffer {
		this.writeCore(n, 'Int', 64, 'BE');
		return this;
	}

	writeFloat32LE(n: number): NaniumBuffer {
		this.writeCore(n, 'Float', 32, 'LE');
		return this;
	}

	writeFloat64LE(n: number): NaniumBuffer {
		this.writeCore(n, 'Float', 64, 'LE');
		return this;
	}


	writeFloat32BE(n: number): NaniumBuffer {
		this.writeCore(n, 'Float', 32, 'BE');
		return this;
	}

	writeFloat64BE(n: number): NaniumBuffer {
		this.writeCore(n, 'Float', 64, 'BE');
		return this;
	}
	//#endregion write Methods

	static isNaniumBuffer(objectOrConstructor: ConstructorType | object): boolean {
		return objectOrConstructor?.['naniumBufferInternalValueSymbol'] != undefined ||
			objectOrConstructor?.constructor?.['naniumBufferInternalValueSymbol'] != undefined;
	}
}

export interface BlobLike {
	readonly size: number;
	readonly type: string;

	arrayBuffer(): Promise<ArrayBuffer>;

	slice(start?: number, end?: number, contentType?: string): BlobLike;

	text(): Promise<string>;
}

export interface BufferLike {
	buffer: ArrayBuffer;
	byteOffset: number;
	length: number;
	poolSize: number;
}

export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array |
	Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;

export type DataSource = (NaniumBuffer | ArrayBuffer | ArrayBufferLike | TypedArray | BlobLike | BufferLike | DataView | ArrayBufferView);


export class NaniumBufferReadable {
	readIndex: number = 0;

	constructor(private data: DataView) {
	}

	static async from(...data: DataSource[]) {
		let nb: NaniumBuffer;
		if (data.length === 1 && data[0] instanceof NaniumBuffer) {
			nb = data[0] as NaniumBuffer;
		} else {
			nb = new NaniumBuffer(data)
		};
		return new NaniumBufferReadable(new DataView(await nb.asArrayBuffer()));
	}

	//#region Read Methods
	startSequentialReadingAt(idx: number) {
		this.readIndex = idx ?? 0;
	}

	readString(length: number, startIdx: number = this.readIndex, encoding: string = 'utf-8'): string {
		const stringView = new Uint8Array(
			this.data.buffer,
			this.data.byteOffset + startIdx,
			length
		);
		this.readIndex += length;
		return new TextDecoder(encoding).decode(stringView);
	};

	readFloat32LE(idx: number = this.readIndex): number {
		this.readIndex += 4;
		return this.data.getFloat32(idx, true);
	}

	readFloat64LE(idx: number = this.readIndex): number {
		this.readIndex += 8;
		return this.data.getFloat64(idx, true);
	}

	readInt8(idx: number = this.readIndex) {
		this.readIndex += 1;
		return this.data.getInt8(idx);
	}

	readInt16LE(idx: number = this.readIndex) {
		this.readIndex += 2;
		return this.data.getInt16(idx, true);
	}

	readInt32LE(idx: number = this.readIndex) {
		this.readIndex += 4;
		return this.data.getInt32(idx, true);
	}
	readBigInt64LE(idx: number = this.readIndex): bigint {
		this.readIndex += 8;
		return this.data.getBigInt64(idx, true);
	}

	readUInt8(idx: number = this.readIndex) {
		this.readIndex += 1;
		return this.data.getUint8(idx);
	}

	readUInt16LE(idx: number = this.readIndex) {
		this.readIndex += 2;
		return this.data.getUint16(idx, true);
	}

	readUInt32LE(idx: number = this.readIndex): number {
		this.readIndex += 4;
		return this.data.getUint32(idx, true);
	}

	readBigUInt64LE(idx: number = this.readIndex): bigint {
		this.readIndex += 8;
		return this.data.getBigUint64(idx, true);
	}

	// BE
	readFloat32BE(idx?: number): number {
		this.readIndex += 4;
		return this.data.getFloat32(idx, false);
	}

	readFloat64BE(idx?: number): number {
		this.readIndex += 8;
		return this.data.getFloat64(idx, false);
	}

	readInt16BE(idx: number = this.readIndex): number {
		this.readIndex += 2;
		return this.data.getInt16(idx, false);
	}

	readInt32BE(idx: number = this.readIndex): number {
		this.readIndex += 4;
		return this.data.getInt16(idx, false);
	}

	readBigInt64BE(idx?: number): bigint {
		this.readIndex += 8;
		return this.data.getBigInt64(idx, false);
	}

	readUInt16BE(idx: number = this.readIndex): number {
		this.readIndex += 2;
		return this.data.getUint16(idx, false);
	}

	readUInt32BE(idx: number = this.readIndex): number {
		this.readIndex += 4;
		return this.data.getUint32(idx, false);
	}

	readBigUInt64BE(idx?: number): bigint {
		this.readIndex += 8;
		return this.data.getBigUint64(idx, false);
	}
	//#endregion Read Methods

}