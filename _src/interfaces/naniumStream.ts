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

const onDataHandlerSymbol: symbol = Symbol.for('NaniumStream_OnDataHandlerSymbol');
const onErrorHandlerSymbol: symbol = Symbol.for('NaniumStream_OnErrorHandlerSymbol');
const onEndHandlerSymbol: symbol = Symbol.for('NaniumStream_OnEndHandlerSymbol');

const STREAM_STATE = {
	PENDING: 'PENDING',
	FULFILLED: 'FULFILLED',
	REJECTED: 'REJECTED',
};

export class NaniumStream<T = any> { //implements Promise<T> {
	@Type(String) id: string;
	@Type(Boolean) isBinary: boolean;

	constructor(itemConstructor?: ConstructorType, genericTypeInfo?: NaniumGenericTypeInfo, id?: string) {
		this[responseTypeSymbol] = itemConstructor;
		this[genericTypesSymbol] = genericTypeInfo;

		this.isBinary = itemConstructor?.name === NaniumBuffer.name;
		this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + '-' + (++uuidCounter);
		this[onDataHandlerSymbol] = [];
		this[onErrorHandlerSymbol] = [];
		this[onEndHandlerSymbol] = [];
	}

	//#region Promise
	toPromise(): Promise<T> {
		return new Promise<T>((resolve: Function, reject: Function) => {
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

	// state = STREAM_STATE.PENDING;
	// value = undefined;
	// [Symbol.toStringTag]: string;
	//
	// private onFinally: Function[] = [];
	// private onRejected: Function[] = [];
	// private onFulfilled: Function[] = [];
	//
	// then<TResult1 = T, TResult2 = never>(
	// 	onFulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
	// 	onRejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
	// ): Promise<TResult1 | TResult2> {
	// 	this.onFulfilled.push(onFulfilled);
	// 	this.onRejected.push(onRejected);
	// 	setTimeout(() => {
	// 		try {
	// 			if (this.id === '99') {
	// 				throw 11;
	// 			} else {
	// 				this.state = STREAM_STATE.FULFILLED;
	// 				this.value = 12;
	// 				this.onFulfilled.forEach(fn => fn(this.value));
	// 			}
	// 		} catch (e) {
	// 			this.state = STREAM_STATE.REJECTED;
	// 			this.onRejected.forEach(fn => fn(e));
	// 		} finally {
	// 			this.onFinally.forEach(fn => fn());
	// 		}
	// 	});
	// 	// ...this.on('data', ...buffer);
	// 	// ...this.on('end'), ...resolve);
	// 	// ...this.on('error'), ...reject);
	// 	return this as NaniumStream;
	// }
	//
	// catch<TResult = never>(onRejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult> {
	// 	this.onRejected.push(onRejected);
	// 	return this;
	// }
	//
	// finally(onFinally?: () => void): Promise<T> {
	// 	this.onFinally.push(onFinally);
	// 	return this;
	// }
	//
	//#endregion Promise

	//#region Stream
	// private handlers: {[ event: string]: Function[] } = {
	// 	'data': [],
	// 	'error': [],
	// 	'end': [],
	// };
	// on(event: 'data' | 'error' | 'end', handler: Function) {
	// 	this.handlers[event].push(handler);
	// }


	//#region readable
	onData(handler: (chunk: T extends NaniumBuffer ? DataSource : T | T[]) => void) {
		this[onDataHandlerSymbol].push(handler);
	}

	onError(handler: (err: any) => void) {
		this[onErrorHandlerSymbol].push(handler);
	}

	onEnd(handler: () => void) {
		this[onEndHandlerSymbol].push(handler);
	}

	// pipeTo()

	// pipeThrough()

	//#endregion readable

	//#region writable
	write(chunk: T extends NaniumBuffer ? DataSource : T | T[]) {
		// if (Array.isArray(chunk)) {
		this[onDataHandlerSymbol].forEach(fn => fn(chunk));
		// } else {
		// this.buffer.write(buffer);
		// }
	}

	error(error: any) {
		this[onErrorHandlerSymbol].forEach(fn => fn(error));
	}

	end() {
		this[onEndHandlerSymbol].forEach(fn => fn());
	}

	//#end region writable

	//#endregion Stream

	static forEachStream(obj: Object, fn: (stream: NaniumStream, type: ConstructorType) => void) {
		if (obj?.constructor?.name === NaniumStream.name) {
			fn(obj as NaniumStream, undefined); // todo: item type with generic parameter
		}
		NaniumObject.forEachProperty(obj, (name: string[], parent, typeInfo: NaniumPropertyInfoCore) => {
			if (typeInfo?.ctor?.name === NaniumStream.name) {
				const stream = parent[name[name.length - 1]];
				if (stream) {
					fn(stream, typeInfo.localGenerics['T']);
				}
			}
		});
	}
}
