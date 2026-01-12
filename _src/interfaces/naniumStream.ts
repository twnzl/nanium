import { ExtendedPromise, uuid } from '../helper';
import {
	ConstructorType,
	genericTypesSymbol,
	NaniumGenericTypeInfo,
	NaniumObject,
	NaniumPropertyInfoCore,
	responseTypeSymbol,
	Type
} from '../objects';
import { NaniumBuffer } from './naniumBuffer';


type Chunk<T> = { value: T } | { end: true } | { error: any };

export class NaniumStream<T = any> implements AsyncIterable<T> {
	@Type(String) id: string;

	#buffer: Chunk<T>[] = [];
	#promises: ExtendedPromise<IteratorResult<T>>[] = [];
	#ended = false;
	#failed: any = null;

	isBinary(): boolean {
		return NaniumBuffer.isNaniumBuffer(this[responseTypeSymbol]);
	}

	static naniumIsNaniumStreamSymbol: symbol = Symbol.for('NaniumStream_IsNaniumStreamSymbol');

	constructor(itemConstructor?: new (...data: any) => T, genericTypeInfo?: NaniumGenericTypeInfo, id?: string) {
		this[responseTypeSymbol] = itemConstructor ?? NaniumBuffer;
		this[genericTypesSymbol] = genericTypeInfo;
		this.id = id ?? uuid()
	}

	//#region sender/writer
	write(value: T): void {
		if (this.#ended || this.#failed) return;

		// for (const value of values) {
		// If a consumer is waiting, resolve immediately
		const promise = this.#promises.shift();
		if (promise) {
			promise.resolve({ value, done: false });
		} else {
			// Otherwise buffer the chunk
			this.#buffer.push({ value });
		}
		// }
	}

	error(err: any) {
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
				promise.resolve({ value: undefined as any, done: true });
			}
		}
	}
	//#endregion sender/writer


	//#region receiver/reader
	// AsyncIterable implementation
	[Symbol.asyncIterator](): AsyncIterator<T> {
		return {
			next: () => this.next()
		};
	}

	private next(): Promise<IteratorResult<T>> {
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
			return Promise.resolve({ value: undefined as any, done: true });
		}

		// Otherwise wait for data/end/error
		const promise = new ExtendedPromise<IteratorResult<T>>();
		this.#promises.push(promise);
		return promise;
	}

	pipeTo(destination: NaniumStream<T>) {
		void (async () => {
			try {
				for await (const chunk of this) {
					destination.write(chunk);
				}
				destination.end();
			} catch (err) {
				destination.error(err);
			}
		})();
	}

	async toPromise(): Promise<T extends NaniumBuffer ? NaniumBuffer : T[]> {
		const objectList: any[] = [];
		const buffer: NaniumBuffer = new NaniumBuffer();
		for await (const chunk of this) {
			if (chunk instanceof NaniumBuffer) {
				buffer.write(chunk);
			} else {
				objectList.push(chunk as any | any[]);
			}
		}
		return (objectList?.length ? objectList.flat(Infinity) : buffer) as T extends NaniumBuffer ? NaniumBuffer : T[];
	}
	//#endregion receiver/reader


	static forEachStream(obj: object, fn: (stream: NaniumStream, type: ConstructorType) => void) {
		if (NaniumStream.isNaniumStream(obj?.constructor)) {
			fn(obj as NaniumStream, undefined); // todo: item type with generic parameter
		}
		NaniumObject.forEachProperty(obj, (name: string[], parent, typeInfo: NaniumPropertyInfoCore) => {
			if (NaniumStream.isNaniumStream(typeInfo?.ctor)) {
				const stream = parent[name[name.length - 1]];
				if (stream) {
					fn(stream, typeInfo.localGenerics['T']);
				}
			}
		});
	}

	static isNaniumStream(objectOrConstructor: ConstructorType | object): boolean {
		const prop: keyof typeof NaniumStream = 'naniumIsNaniumStreamSymbol';
		return objectOrConstructor?.[prop] != undefined ||
			objectOrConstructor?.constructor?.[prop] != undefined;
	}
}
