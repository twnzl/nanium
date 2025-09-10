import { ConstructorType, NaniumObject, Type } from '../objects';

let uuidCounter: number = 0;

export class NaniumBuffer {
	@Type(String) id: string;
	private static naniumBufferInternalValueSymbol: symbol = Symbol.for('__Nanium__BufferInternalValueSymbol__');

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

		// return proxy to implement the indexer Property
		// let self = this;
		// return new Proxy(this, {
		// 	get(target, prop) {
		// 		// @ts-ignore
		// 		if (Number(prop) == prop && !(prop in target)) {
		// 			...
		// 		}
		// 		return target[prop];
		// 	}
		// });
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


	async asUint8Array_(): Promise<Uint8Array> {
		const internalValues = this[NaniumBuffer.naniumBufferInternalValueSymbol];

		// if there is only one buffer, we do not need to copy the data.
		// For performance, we just wrap the original data with UInt8Array. But keep in mind that changing the original
		// buffer changes the result of this function
		if (internalValues.length === 1) {
			const data = internalValues[0];

			if (this.isArrayBufferLike(data)) {
				return new Uint8Array(data);
			} else if (this.isBlobLike(data)) {
				const arrayBuffer = await data.arrayBuffer();
				return new Uint8Array(arrayBuffer);
			} else if (this.isTypedArrayLike(data)) {
				// TypedArray: Nur den genutzten Bereich verwenden
				return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
			} else if (this.isBufferLike(data)) {
				// Node.js Buffer: Direkte Konvertierung
				return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
			} else {
				throw new Error(`Unsupported data type: ${typeof data}`);
			}
		}

		// if there are multiple parts create a new buffer and copy data of all parts into it
		const result = new Uint8Array(this.length);
		let offset = 0;

		for (const part of internalValues) {
			let sourceBytes: Uint8Array;
			let bytesToCopy: number;

			if (this.isBlobLike(part)) {
				const arrayBuffer = await part.arrayBuffer();
				sourceBytes = new Uint8Array(arrayBuffer);
				bytesToCopy = sourceBytes.length;
			} else if (this.isTypedArrayLike(part)) {
				// TypedArray: Korrekte Behandlung von byteOffset und byteLength
				sourceBytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
				bytesToCopy = part.byteLength;
			} else if (this.isBufferLike(part)) {
				// Node.js Buffer
				sourceBytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
				bytesToCopy = part.byteLength;
			} else if (this.isArrayBufferLike(part)) {
				sourceBytes = new Uint8Array(part);
				bytesToCopy = part.byteLength;
			} else {
				throw new Error(`Unsupported data type: ${typeof part}`);
			}

			// efficient copy using set()
			result.set(sourceBytes, offset);
			offset += bytesToCopy;
		}

		return result;
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

	async asArrayBuffer(): Promise<ArrayBuffer> {
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

		for (const part of this[NaniumBuffer.naniumBufferInternalValueSymbol]) {
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

	//#region Read Methods
	async readString(idx: number, length: number, encoding: string = 'utf-8'): Promise<string> {
		const bytes = this.slice(idx, idx + length);
		return new TextDecoder(encoding).decode(await bytes.asUint8Array());
	};

	async readBigInt64LE(idx: number): Promise<bigint> {
		return (await this.slice(idx, BigInt64Array.BYTES_PER_ELEMENT).as(BigInt64Array))[0];
	}

	async readBigUInt64LE(idx: number): Promise<bigint> {
		return (await this.slice(idx, BigUint64Array.BYTES_PER_ELEMENT).as(BigUint64Array))[0];
	}

	async readFloat32LE(idx: number): Promise<number> {
		return (await this.slice(idx, idx + Float32Array.BYTES_PER_ELEMENT).as(Float32Array))[0];
	}

	async readFloat64LE(idx: number): Promise<number> {
		return (await this.slice(idx, idx + Float64Array.BYTES_PER_ELEMENT).as(Float64Array))[0];
	}

	async readInt8LE(idx: number) {
		return (await this.slice(idx, idx + Int8Array.BYTES_PER_ELEMENT).as(Int8Array))[0];
	}

	async readInt16LE(idx: number) {
		return (await this.slice(idx, idx + Int16Array.BYTES_PER_ELEMENT).as(Int16Array))[0];
	}

	async readInt32LE(idx: number) {
		return (await this.slice(idx, idx + Int32Array.BYTES_PER_ELEMENT).as(Int32Array))[0];
	}

	async readUInt8LE(idx: number) {
		return (await this.slice(idx, idx + Uint8Array.BYTES_PER_ELEMENT).as(Uint8Array))[0];
	}

	async readUInt16LE(idx: number) {
		return (await this.slice(idx, idx + Uint16Array.BYTES_PER_ELEMENT).as(Uint16Array))[0];
	}

	async readUInt32LE(idx: number) {
		return (await this.slice(idx, idx + Uint32Array.BYTES_PER_ELEMENT).as(Uint32Array))[0];
	}

	async readBigInt64BE(idx: number): Promise<bigint> {
		const bytes = await this.slice(idx, idx + BigInt64Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getBigInt64(0, false); // false = Big-Endian
	}

	async readBigUInt64BE(idx: number): Promise<bigint> {
		const bytes = await this.slice(idx, idx + BigUint64Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getBigUint64(0, false); // false = Big-Endian
	}

	async readFloat32BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Float32Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getFloat32(0, false); // false = Big-Endian
	}

	async readFloat64BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Float64Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getFloat64(0, false); // false = Big-Endian
	}

	async readInt8BE(idx: number): Promise<number> {
		// Int8 hat keine Endianness, aber für Konsistenz
		return (await this.slice(idx, idx + Int8Array.BYTES_PER_ELEMENT).as(Int8Array))[0];
	}

	async readInt16BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Int16Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getInt16(0, false); // false = Big-Endian
	}

	async readInt32BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Int32Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getInt32(0, false); // false = Big-Endian
	}

	async readUInt8BE(idx: number): Promise<number> {
		// UInt8 hat keine Endianness, aber für Konsistenz
		return (await this.slice(idx, idx + Uint8Array.BYTES_PER_ELEMENT).as(Uint8Array))[0];
	}

	async readUInt16BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Uint16Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getUint16(0, false); // false = Big-Endian
	}

	async readUInt32BE(idx: number): Promise<number> {
		const bytes = await this.slice(idx, idx + Uint32Array.BYTES_PER_ELEMENT).asUint8Array();
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return view.getUint32(0, false); // false = Big-Endian
	}
	//#endregion Read Methods

	//#region write methods
	writeString(text: string): void {
		this.write(new TextEncoder().encode(text));
	};

	writeCore(n: number, type: 'Int' | 'Float', bits: 8 | 16 | 32 | 64, endianness: 'LE' | 'BE' = 'LE'): void {
		const buffer = new ArrayBuffer(bits / 8);
		new DataView(buffer)['set' + type + bits](0, n, endianness === 'LE');
		this[NaniumBuffer.naniumBufferInternalValueSymbol].push(buffer);
	}

	writeInt8(n: number): void {
		this.writeCore(n, 'Int', 8, 'LE');
	}

	writeInt16LE(n: number): void {
		this.writeCore(n, 'Int', 16, 'LE');
	}

	writeInt16BE(n: number): void {
		this.writeCore(n, 'Int', 16, 'BE');
	}

	writeInt32LE(n: number): void {
		this.writeCore(n, 'Int', 32, 'LE');
	}

	writeInt32BE(n: number): void {
		this.writeCore(n, 'Int', 32, 'BE');
	}

	writeInt64LE(n: number): void {
		this.writeCore(n, 'Int', 64, 'LE');
	}

	writeInt64BE(n: number): void {
		this.writeCore(n, 'Int', 64, 'BE');
	}

	writeFloat32LE(n: number): void {
		this.writeCore(n, 'Float', 32, 'LE');
	}

	writeFloat64LE(n: number): void {
		this.writeCore(n, 'Float', 64, 'LE');
	}


	writeFloat32BE(n: number): void {
		this.writeCore(n, 'Float', 32, 'BE');
	}

	writeFloat64BE(n: number): void {
		this.writeCore(n, 'Float', 64, 'BE');
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

	stream(): any;

	text(): Promise<string>;
}

export type DataSource = (NaniumBuffer | ArrayBuffer | Uint8Array | BlobLike);
