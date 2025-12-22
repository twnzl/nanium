import { ExtendedPromise } from '../helper';
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


export class NaniumStream<T = any> {
	@Type(String) id: string;

	async isReceiverReady(): Promise<boolean> {
		return await this[NaniumStream.naniumStreamIdReceiverReadyPromiseSymbol];
	};

	cancelWaitingForReceiver(msg: string = 'NaniumStream: canceled'): void {
		this[NaniumStream.naniumStreamIdReceiverReadyPromiseSymbol].cancel(msg);
	}

	isBinary(): boolean {
		return NaniumBuffer.isNaniumBuffer(this[responseTypeSymbol]);
	}

	static naniumStreamOnDataHandlerSymbol: symbol = Symbol.for('NaniumStream_OnDataHandlerSymbol');
	static naniumStreamOnErrorHandlerSymbol: symbol = Symbol.for('NaniumStream_OnErrorHandlerSymbol');
	static naniumStreamOnEndHandlerSymbol: symbol = Symbol.for('NaniumStream_OnEndHandlerSymbol');
	static naniumStreamIdReceiverReadyPromiseSymbol: symbol = Symbol.for('NaniumStream_OnReceiverSymbol');

	constructor(itemConstructor?: new (...data: any) => T, genericTypeInfo?: NaniumGenericTypeInfo, id?: string) {
		this[responseTypeSymbol] = itemConstructor ?? NaniumBuffer;
		this[genericTypesSymbol] = genericTypeInfo;
		this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + '-' + (++uuidCounter);
		this[NaniumStream.naniumStreamOnDataHandlerSymbol] = [];
		this[NaniumStream.naniumStreamOnErrorHandlerSymbol] = [];
		this[NaniumStream.naniumStreamOnEndHandlerSymbol] = [];
		this[NaniumStream.naniumStreamIdReceiverReadyPromiseSymbol] = new ExtendedPromise<boolean>();
	}

	//#region Promise
	toPromise(): Promise<T extends NaniumBuffer ? NaniumBuffer : T[]> {
		return new Promise<T extends NaniumBuffer ? NaniumBuffer : T[]>((resolve: Function, reject: Function) => {
			try {
				const objectList: any[] = [];
				const buffer: NaniumBuffer = new NaniumBuffer();
				this.onData(async (chunk) => {
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

	receiverReady() {
		this[NaniumStream.naniumStreamIdReceiverReadyPromiseSymbol].resolve();
	}

	//#region readable
	onData(handler: (chunk: T extends NaniumBuffer ? NaniumBuffer : T) => Promise<void>) {
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
		this.onData(async chunk => await s.write(chunk));
		this.onEnd(() => s.end());
		this.onError((err: Error) => s.error(err));
	}

	// pipeThrough()

	//#endregion readable

	//#region writable
	async write(chunk: T extends NaniumBuffer ? DataSource : T | T[]): Promise<void> {
	// todo: it must be possible to return an array as a whole response
		if (Array.isArray(chunk)) {
			for (const item of chunk) {
				await Promise.all(this[NaniumStream.naniumStreamOnDataHandlerSymbol].map(handler => handler(item)));
			}
		} else {
			await Promise.all(this[NaniumStream.naniumStreamOnDataHandlerSymbol].map(handler => handler(chunk)));
		}
	}

	error(error: any) {
		this[NaniumStream.naniumStreamOnErrorHandlerSymbol].forEach(fn => fn(error));
	}

	end() {
		this[NaniumStream.naniumStreamOnEndHandlerSymbol].forEach(fn => fn());
	}

	//#end region writable

	//#endregion Stream

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
		return objectOrConstructor?.['naniumStreamOnEndHandlerSymbol'] != undefined ||
			objectOrConstructor?.constructor?.['naniumStreamOnEndHandlerSymbol'] != undefined;
	}
}
