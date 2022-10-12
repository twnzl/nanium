import { Type } from '../objects';
import { NaniumSymbols } from './symbols';

let uuidCounter: number = 0;

export class NaniumBuffer {
	@Type(String) id: string;
	private static textEncoder: TextEncoder = new TextEncoder();

	constructor(data?: DataSource | DataSource[], id?: string) {
		this[NaniumSymbols.bufferInternalValueSymbol] = [];
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

	get length(): number {
		const lengths = this[NaniumSymbols.bufferInternalValueSymbol].map(part =>
			part === undefined ? 0 : (
				(typeof part === 'string') ? (NaniumBuffer.textEncoder.encode(part)).length : (
					(part as ArrayBuffer).byteLength ??
					(part as any).length ??
					(part as Blob).size
				)
			)
		);
		if (lengths?.length) {
			return lengths.reduce((whole, next) => whole + next);
		} else {
			return 0;
		}
	}

	write(data: DataSource) {
		if (data instanceof NaniumBuffer || data?.constructor?.name === NaniumBuffer.name) {
			let part: any;
			const length = data[NaniumSymbols.bufferInternalValueSymbol].length;
			for (let i = 0; i < length; i++) {
				part = data[NaniumSymbols.bufferInternalValueSymbol][i];
				this[NaniumSymbols.bufferInternalValueSymbol].push(part);
			}
		} else {
			this[NaniumSymbols.bufferInternalValueSymbol].push(data);
		}
	}

	static async as<T>(targetType: new (first?: any, second?: any, third?: any) => T, data: DataSource): Promise<T> {
		if (data.constructor.name === NaniumBuffer.name) {
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
		} else if (targetType.name === 'String') {
			return new TextDecoder().decode(data) as unknown as T;
		} else { // Buffer or any typed Array
			return new targetType(data.buffer, data.byteOffset, data.byteLength / targetType['BYTES_PER_ELEMENT'] ?? 1);
		}
	}

	async asUint8Array(): Promise<Uint8Array> {
		const internalValues = this[NaniumSymbols.bufferInternalValueSymbol];
		// if there is only one buffer, we do not need to copy the data.
		// For performance, we just wrap the original data with UInt8Array. But keep in mind that changing the original
		// buffer changes the result of this function
		if (internalValues.length === 1) {
			const data = internalValues[0];
			if (data?.constructor?.name === 'ArrayBuffer') {
				return new Uint8Array(data);
			} else if (data?.constructor?.name === 'Blob') {
				return new Uint8Array(await data.arrayBuffer(), 0, data.size);
			} else if (data?.constructor?.name === 'String') {
				return new TextEncoder().encode(data);
			} else { // Buffer or any typed Array
				return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
			}
		}

		// if there are multiple parts create a new buffer and copy data of all parts into it
		const result = new Uint8Array(this.length);
		let tmp: Uint8Array;
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
			} else if (typeof part === 'string') { // String
				tmp = NaniumBuffer.textEncoder.encode(part);
				for (i = 0; i < tmp.byteLength; ++i) {
					result[j + i] = tmp[i];
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
		this[NaniumSymbols.bufferInternalValueSymbol] = [];
	}

	async asString(): Promise<string> {
		const result: string[] = [];
		for (const part of this[NaniumSymbols.bufferInternalValueSymbol]) {
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
}

export interface BlobLike {
	readonly size: number;
	readonly type: string;

	arrayBuffer(): Promise<ArrayBuffer>;

	slice(start?: number, end?: number, contentType?: string): BlobLike;

	stream(): any;

	text(): Promise<string>;
}

export type DataSource = (NaniumBuffer | ArrayBuffer | Uint8Array | BlobLike | string);
