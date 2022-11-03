import { Type } from '../objects';

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
		if (targetType.name === 'ArrayBuffer') {
			return await this.asArrayBuffer() as unknown as T;
		}
		const data = await this.asUint8Array();
		if (targetType.name === 'Blob') {
			return new targetType([data]);
		} else if (targetType.name === 'Buffer') {
			return targetType['from'](data.buffer);
		} else { // any typed Array
			return new targetType(data.buffer, data.byteOffset, data.byteLength / targetType['BYTES_PER_ELEMENT'] ?? 1);
		}
	}

	async asUint8Array(): Promise<Uint8Array> {
		const internalValues = this[NaniumBuffer.naniumBufferInternalValueSymbol];
		// if there is only one buffer, we do not need to copy the data.
		// For performance, we just wrap the original data with UInt8Array. But keep in mind that changing the original
		// buffer changes the result of this function
		if (internalValues.length === 1) {
			const data = internalValues[0];
			if (data?.constructor?.name === 'ArrayBuffer') {
				return new Uint8Array(data);
			} else if (data?.constructor?.name === 'Blob') {
				return new Uint8Array(await data.arrayBuffer(), 0, data.size);
			} else { // Buffer or any typed Array
				return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
			}
		}

		// if there are multiple parts create a new buffer and copy data of all parts into it
		const result = new Uint8Array(this.length);
		let i: number = 0;
		let j: number = 0;
		for (const part of internalValues) {
			if (typeof part['arrayBuffer'] === 'function') { // Blob
				const view = new Uint8Array(await part.arrayBuffer());
				if (internalValues.length === 1) {
					return view;
				}
				for (i = 0; i < (view).length; ++i) {
					result[j + i] = view[i];
				}
			} else if (part['buffer']) { // Buffer & UInt8Array & ...
				if (part.byteLength !== part.length) {
					const view = new Uint8Array(part.buffer);
					for (i = 0; i < part.byteLength; ++i) {
						result[j + i] = view[i];
					}
				} else {
					for (i = 0; i < part.byteLength; ++i) {
						result[j + i] = part[i];
					}
				}
			} else { // ArrayBuffer
				const view = new Uint8Array(part);
				if (internalValues.length === 1) {
					return view;
				}
				for (i = 0; i < view.byteLength; ++i) {
					result[j + i] = view[i];
				}
			}
			j += i;
		}
		return result;
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

	async asString(): Promise<string> {
		const result: string[] = [];
		for (const part of this[NaniumBuffer.naniumBufferInternalValueSymbol]) {
			if (typeof part['text'] === 'function') { // Blob
				result.push(await part['text']());
			} else if (typeof part === 'string') { // String
				result.push(part);
			} else { // Buffer or ArrayBuffer
				result.push(new TextDecoder().decode(part));
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
		while (true) {
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
