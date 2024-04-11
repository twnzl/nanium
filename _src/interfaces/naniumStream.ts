import {
	ConstructorType,
	genericTypesSymbol,
	NaniumGenericTypeInfo,
	NaniumObject,
	NaniumPropertyInfoCore,
	responseTypeSymbol,
	Type
} from '../objects';
import { DataSource, NaniumBuffer } from './naniumBuffer';

let uuidCounter: number = 0;


export class NaniumStream<T = any> { //implements Promise<T> {
	@Type(String) id: string;
	@Type(Boolean) isBinary: boolean;

	static naniumStreamOnDataHandlerSymbol: symbol = Symbol.for('NaniumStream_OnDataHandlerSymbol');
	static naniumStreamOnErrorHandlerSymbol: symbol = Symbol.for('NaniumStream_OnErrorHandlerSymbol');
	static naniumStreamOnEndHandlerSymbol: symbol = Symbol.for('NaniumStream_OnEndHandlerSymbol');

	constructor(itemConstructor?: new (...data: any) => T, genericTypeInfo?: NaniumGenericTypeInfo, id?: string) {
		this[responseTypeSymbol] = itemConstructor ?? NaniumBuffer;
		this[genericTypesSymbol] = genericTypeInfo;

		this.isBinary = itemConstructor?.name === NaniumBuffer.name;
		this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + '-' + (++uuidCounter);
		this[NaniumStream.naniumStreamOnDataHandlerSymbol] = [];
		this[NaniumStream.naniumStreamOnErrorHandlerSymbol] = [];
		this[NaniumStream.naniumStreamOnEndHandlerSymbol] = [];
	}

	//#region Promise
	toPromise(): Promise<T extends NaniumBuffer ? NaniumBuffer : T[]> {
		return new Promise<T extends NaniumBuffer ? NaniumBuffer : T[]>((resolve: Function, reject: Function) => {
			try {
				const objectList: any[] = [];
				const buffer: NaniumBuffer = new NaniumBuffer();
				this.onData((chunk): void => {
					if (this.isBinary) {
						buffer.write(chunk as DataSource);
					} else {
						objectList.push(chunk as any | any[]);
					}
				});
				this.onEnd(() => {
					resolve(this.isBinary ? buffer : objectList.flat(Infinity));
				});
				this.onError((err: Error) => {
					reject(err);
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	//#region readable
	onData(handler: (chunk: T extends NaniumBuffer ? NaniumBuffer : T) => void) {
		this[NaniumStream.naniumStreamOnDataHandlerSymbol].push(handler);
		return this;
	}

	onError(handler: (err: any) => void) {
		this[NaniumStream.naniumStreamOnErrorHandlerSymbol].push(handler);
		return this;
	}

	onEnd(handler: () => void) {
		this[NaniumStream.naniumStreamOnEndHandlerSymbol].push(handler);
		return this;
	}

	pipeTo(s: NaniumStream<T>) {
		this.onData(chunk => s.write(chunk));
		this.onEnd(() => s.end());
		this.onError((err: Error) => s.error(err));
	}

	// pipeThrough()

	//#endregion readable

	//#region writable
	write(chunk: T extends NaniumBuffer ? DataSource : T | T[]) {
		// if (NaniumBuffer.isNaniumBuffer(chunk)) {
		// 	this.buffer.write(chunk);
		// } else {
		if (Array.isArray(chunk)) {
			chunk.forEach(item => this[NaniumStream.naniumStreamOnDataHandlerSymbol].forEach(fn => fn(item)));
		} else {
			this[NaniumStream.naniumStreamOnDataHandlerSymbol].forEach(fn => fn(chunk));
		}
		// }
	}

	error(error: any) {
		this[NaniumStream.naniumStreamOnErrorHandlerSymbol].forEach(fn => fn(error));
	}

	end() {
		this[NaniumStream.naniumStreamOnEndHandlerSymbol].forEach(fn => fn());
	}

	//#end region writable

	//#endregion Stream

	static forEachStream(obj: Object, fn: (stream: NaniumStream, type: ConstructorType) => void) {
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
		return objectOrConstructor?.['naniumStreamOnEndHandlerSymbol'] != undefined ||
			objectOrConstructor?.constructor?.['naniumStreamOnEndHandlerSymbol'] != undefined;
	}
}
