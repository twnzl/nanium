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
			(typeof part === 'string') ? (NaniumBuffer.textEncoder.encode(part)).length :
				(part as ArrayBuffer).byteLength ??
				(part as any).length ??
				(part as Blob).size
		);
		if (lengths?.length) {
			return lengths.reduce((whole, next) => whole + next);
		} else {
			return 0;
		}
	}

	write(data: DataSource | NaniumBuffer) {
		if (data instanceof NaniumBuffer || data?.constructor?.name === NaniumBuffer.name) {
			for (const part of data[NaniumSymbols.bufferInternalValueSymbol]) {
				this[NaniumSymbols.bufferInternalValueSymbol].push(part);
			}
		} else {
			this[NaniumSymbols.bufferInternalValueSymbol].push(data);
		}
	}

	async asUint8Array(): Promise<Uint8Array> {
		const result = new Uint8Array(this.length);
		let tmp: Uint8Array;
		let i: number = 0;
		let j: number = 0;
		for (const part of this[NaniumSymbols.bufferInternalValueSymbol]) {
			if (typeof part['arrayBuffer'] === 'function') { // Blob
				const view = new Uint8Array(await part.arrayBuffer());
				if (this[NaniumSymbols.bufferInternalValueSymbol].length === 1) {
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
				if (this[NaniumSymbols.bufferInternalValueSymbol].length === 1) {
					return new Uint8Array(part.buffer);
				}
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
				if (this[NaniumSymbols.bufferInternalValueSymbol].length === 1) {
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

export interface ReadableStream {
	[Symbol.iterator](): IterableIterator<any>;

	entries(): IterableIterator<[number, any]>;

	keys(): IterableIterator<number>;

	values(): IterableIterator<any>;
}

export interface Blob {
	readonly size: number;
	readonly type: string;

	arrayBuffer(): Promise<ArrayBuffer>;

	slice(start?: number, end?: number, contentType?: string): Blob;

	stream(): ReadableStream;

	text(): Promise<string>;
}

export type DataSource = (ArrayBuffer | Uint8Array | Blob | string);
