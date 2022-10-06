import { NaniumBuffer } from './naniumBuffer';
import { ConstructorType, NaniumObject, NaniumPropertyInfoCore, Type } from '../objects';

export interface ObserverLike<T = any> {
	next?: (next: T) => void,
	error?: (e: any) => void,
	complete?: () => void,
}

let uuidCounter: number = 0;

const observersSymbol: symbol = Symbol.for('__Nanium__observersSymbol__');

export class NaniumStream<T = any> {
	@Type(String) id: string;

	constructor(id?: string) {
		this.id = id ?? Date.now() + '-' + Math.random().toFixed(20).substring(2) + '-' + (++uuidCounter);
		this[observersSymbol] = [];
	}

	// read
	subscribe(observer: ObserverLike<T>) {
		this[observersSymbol].push(observer);
	}

	unsubscribe(observer: ObserverLike<T>) {
		this[observersSymbol] = this[observersSymbol].filter(o => o !== observer);
	}

	pipeTo(targetStream: { getWriter: Function } | { write: Function }) {
		const writer: { write: Function, end?: Function, close?: Function } =
			(typeof targetStream['getWriter'] === 'function' ? targetStream['getWriter']() : targetStream);
		const observer = {
			next: (part) => {
				// todo: streams: if type of NaniumStream is not NaniumBuffer, then serialize part
				writer.write((part as unknown as NaniumBuffer).asUint8Array()).then();
			},
			error: () => {
				// todo: streams: is here something to do?
			},
			complete: () => {
				typeof writer.close === 'function' ? writer.close() : writer.end();
				this.unsubscribe(observer);
			}
		};
		this.subscribe(observer);
	}

	// todo: streams: add Promise interface, so that 'await naniumStream' is possible and gives the whole content as one result after stream end
	// catch<TResult>(onrejected?: Function | undefined | null): Promise<T | TResult> {
	//
	// }
	//
	// then<TResult1, TResult2>(
	// 	onfulfilled?: Function | undefined | null,
	// 	onrejected?: Function | undefined | null
	// ): Promise<TResult1 | TResult2> {
	//
	// }

	// write
	next(part: T) {
//???? this[NaniumStream.observersSymbol] ist hier immer ein leerer Array, obwohl im subscribe ein observer hinzugefügt wurde
		this[observersSymbol].forEach(observer => {
			if (typeof observer?.next === 'function') {
				observer.next(part);
			}
		});
	};

	error(e: any) {
		this[observersSymbol].forEach(observer => {
			if (typeof observer?.error === 'function') {
				observer.error(e);
			}
		});
	};

	complete() {
		this[observersSymbol].forEach(observer => {
			if (typeof observer?.complete === 'function') {
				observer.complete();
				this.unsubscribe(observer);
			}
		});
	};

	pipeFrom(sourceStream: ReadableStream) {
		const reader = sourceStream.getReader();
		return new ReadableStream({
			cancel: (reason?: any): void => {
				this.error(reason);
				// this.activeRequests = this.activeRequests.filter(r => r !== abortController);
			},
			start: (controller: ReadableStreamDefaultController): void => {
				const push: () => void = () => {
					reader.read().then(({ done, value }) => {
						if (done) {
							controller.close();
							this.complete();
							// this.activeRequests = this.activeRequests.filter(r => r !== abortController);
							return;
						}
						try {
							// if (request.constructor[responseTypeSymbol] === ArrayBuffer) {
							this.next(value);
							// }

							// todo: streams: implement deserialization
							// else {
							// 	deserialized = this.config.serializer.deserializePartial(value, restFromLastTime);
							// 	if (deserialized.data?.length) {
							// 		for (const data of deserialized.data) {
							// 			observer.next(NaniumObject.create(
							// 				data,
							// 				request.constructor[responseTypeSymbol],
							// 				request.constructor[genericTypesSymbol]
							// 			));
							// 		}
							// 	}
							// 	restFromLastTime = deserialized.rest;
							// }
						} catch (e) {
							// this.activeRequests = this.activeRequests.filter(r => r !== abortController);
							controller.close();
							this.error(e);
						}

						// read next portion from stream
						push();
					});
				};

				// start reading from stream
				push();
			},
		});
	}

	static forEachStream(obj: Object, fn: (stream: NaniumStream, type: ConstructorType) => void) {
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
