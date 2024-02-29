import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { HttpCore } from './http.core';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
import { NaniumStream } from '../../interfaces/naniumStream';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';

const requestStreamingBufferSymbol: symbol = Symbol.for('__Nanium__requestStreamingBufferSymbol__');

export interface NaniumConsumerBrowserHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl?: string;
	onServerConnectionRestored?: () => void;
	requestStreamingBufferSize?: number;
}

export class NaniumConsumerBrowserHttp implements ServiceManager {
	config: NaniumConsumerBrowserHttpConfig;
	private httpCore: HttpCore;
	private activeRequests: { abort: Function }[] = [];

	constructor(config?: NaniumConsumerBrowserHttpConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				apiEventUrl: '/events',
				onServerConnectionRestored: () => {
				},
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					alert(response);
					return Promise.resolve();
				},
				isResponsible: async (): Promise<number> => Promise.resolve(1),
				isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
				requestStreamingBufferSize: 1024 * 1024
			},
			...(config || {})
		};
		this.httpCore = new HttpCore(this.config,
			async (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => await this.httpRequest(method, url, body, headers),
			(url, stream) => this.httpRequestStreaming(url, stream),
			(url, stream) => this.httpResponseStreaming(url, stream)
		);
	}

	async init(): Promise<void> {
		if (!this.config.apiUrl.startsWith('http')) {
			this.config.apiUrl = window.location.protocol + '//' + window.location.host +
				(this.config.apiUrl.startsWith('/') ? '' : '/') + this.config.apiUrl;
		}
	}

	async terminate(): Promise<void> {
		for (const ar of this.activeRequests) {
			ar.abort();
		}
		this.activeRequests = [];
		this.httpCore.id = undefined;
		this.httpCore.terminated = true;
		this.httpCore = new HttpCore(this.config,
			async (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => await this.httpRequest(method, url, body, headers),
			(url, stream) => this.httpRequestStreaming(url, stream),
			(url, stream) => this.httpResponseStreaming(url, stream),
		);
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute<T>(serviceName: string, request: any, executionContext?: ExecutionContext): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors?.length) {
			let result: any;
			for (const interceptor of this.config.requestInterceptors) {
				result = await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, executionContext ?? {});
				// if an interceptor returns an object other than the request it is a result and the execution shall be
				// finished with this result
				if (result !== undefined && result !== request) {
					return result;
				}
			}
		}

		// execute the request
		const response = await this.httpCore.sendRequest(serviceName, request);

		// execute response interceptors
		if (this.config.responseInterceptors?.length) {
			let responseFromInterceptor: any;
			for (const interceptor of this.config.responseInterceptors) {
				responseFromInterceptor = await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, response);
				// if an interceptor returns an object other than the original response instance, the returned value will replace the original response;
				if (responseFromInterceptor !== undefined && responseFromInterceptor !== response) {
					return responseFromInterceptor;
				}
			}
		}

		return response;
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = async (): Promise<void> => {
				// interceptors
				let result: any;
				for (const interceptor of this.config.requestInterceptors) {
					result = await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
					// if an interceptor returns an object other than the request it is a result and the execution shall be
					// finished with this result
					if (result && result !== request) {
						return result;
					}
				}

				// transmission
				const abortController: AbortController = new AbortController();
				this.activeRequests.push(abortController);
				const req: Request = new Request(this.config.apiUrl + '?' + serviceName, {
					method: 'post',
					mode: 'cors',
					redirect: 'follow',
					body: this.config.serializer.serialize({ serviceName, streamed: true, request }),
					signal: abortController.signal // make the request abortable
				});

				fetch(req)
					.then((response) => response.body)
					.then((rb) => {
						const reader: ReadableStreamDefaultReader<Uint8Array> = rb.getReader();

						let restFromLastTime: any;
						let deserialized: {
							data: any;
							rest: any;
						};

						return new ReadableStream({
							cancel: (reason?: any): void => {
								observer.error(reason);
								this.activeRequests = this.activeRequests.filter(r => r !== abortController);
							},
							start: (controller: ReadableStreamDefaultController<any>): void => {
								const push: () => void = () => {
									reader.read().then(({ done, value }) => {
										if (done) {
											controller.close();
											observer.complete();
											this.activeRequests = this.activeRequests.filter(r => r !== abortController);
											return;
										}
										try {
											if (
												request.constructor[responseTypeSymbol] === ArrayBuffer ||
												(request.constructor[responseTypeSymbol] && request.constructor[responseTypeSymbol]['naniumBufferInternalValueSymbol'])
											) {
												observer.next(value.constructor['naniumBufferInternalValueSymbol'] ? value : new NaniumBuffer(value));
											} else {
												deserialized = this.config.serializer.deserializePartial(value, restFromLastTime);
												if (deserialized.data?.length) {
													for (const data of deserialized.data) {
														observer.next(NaniumObject.create(
															data,
															request.constructor[responseTypeSymbol],
															request.constructor[genericTypesSymbol]
														));
													}
												}
												restFromLastTime = deserialized.rest;
											}
										} catch (e) {
											this.activeRequests = this.activeRequests.filter(r => r !== abortController);
											controller.close();
											observer.error(e);
										}

										// read next portion from stream
										push();
									});
								};

								// start reading from stream
								push();
							},
						});
					});

				this.config.serializer.serialize({ serviceName, streamed: true, request });
			};

			core();
		});

	}

	async subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<EventSubscription> {
		return await this.httpCore.subscribe(eventConstructor, handler);
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		await this.httpCore.unsubscribe(subscription, eventName);
	}

	emit(eventName: string, event: any, context: ExecutionContext): any {
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}

	async httpRequest(method: 'GET' | 'POST', url: string, body?: string | ArrayBuffer | FormData, headers?: any): Promise<ArrayBuffer> {
		return new Promise<ArrayBuffer>((resolve: Function, reject: Function) => {
			// transmission
			const abortController: AbortController = new AbortController();
			this.activeRequests.push(abortController);
			const req: Request = new Request(url, {
				method: method,
				body: body,
				headers: headers,
				signal: abortController.signal // make the request abortable
			});
			fetch(req)
				.then(async (response) => {
					const data: ArrayBuffer = await response.arrayBuffer();
					if (response.ok) {
						resolve(data);
					} else {
						reject(data);
					}
				})
				.catch((error) => {
					reject(error);
				})
				.finally(() => {
					this.activeRequests = this.activeRequests.filter(r => r !== abortController);
				});
		});
	}

	httpRequestStreaming(url: string, requestStream: NaniumStream) {
		let partIdx = 0; // to make sure that the order of the parts is kept - multiple http requests might overtake each other
		const observer = {
			next: async (part) => {
				if (!requestStream[requestStreamingBufferSymbol]) {
					requestStream[requestStreamingBufferSymbol] = new NaniumBuffer();
				}
				// sending multiple http requests is at the moment the most secure way. (e.g. using fetch body streaming can end with ERR_QUIC_PROTOCOL_ERROR in Chrome)
				if (part instanceof NaniumBuffer || part instanceof Blob || part instanceof ArrayBuffer || part.buffer) {
					(requestStream[requestStreamingBufferSymbol] as NaniumBuffer).write(part);
					// 	this.httpRequest('POST', url + '/' + (++partIdx), part.asUint8Array()).then();
					// } else if (part instanceof Blob) {
					// 	this.httpRequest('POST', url + '/' + (++partIdx), await (part as Blob).arrayBuffer()).then();
					// } else if (part instanceof ArrayBuffer) {
					// 	this.httpRequest('POST', url + '/' + (++partIdx), part).then();
				} else {
					// todo: streams: !!! if part is not binary serialize it
				}
				// collect multiple parts if they are small and send bigger but fewer packages (important for streaming non-binary data)
				if (requestStream[requestStreamingBufferSymbol].length >= this.config.requestStreamingBufferSize) {
					this.httpRequest('POST', url + '/' + (++partIdx), (requestStream[requestStreamingBufferSymbol] as NaniumBuffer).asUint8Array()).then();
					(requestStream[requestStreamingBufferSymbol] as NaniumBuffer).clear();
				}
			},
			error: () => {
				// todo: streams: something to do?
			},
			complete: () => {
				// if there are collected parts left that have not yet been sent, send it.
				if (requestStream[requestStreamingBufferSymbol].length) {
					this.httpRequest('POST', url + '/' + (++partIdx), (requestStream[requestStreamingBufferSymbol] as NaniumBuffer).asUint8Array()).then();
				}
				this.httpRequest('POST', url + '/' + (++partIdx), null).then();
				requestStream.unsubscribe(observer);
			}
		};
		requestStream.subscribe(observer);
	}

	httpResponseStreaming(url: string, responseStream: NaniumStream) {
		const core: Function = async (): Promise<void> => {
			// // interceptors
			// for (const interceptor of this.config.requestInterceptors) {
			// 	await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
			// }

			// transmission
			const abortController: AbortController = new AbortController();
			this.activeRequests.push(abortController);
			const req: Request = new Request(url, {
				method: 'get',
				mode: 'cors',
				redirect: 'follow',
				signal: abortController.signal // make the request abortable
			});

			fetch(req)
				.then((response) => response.body)
				.then((rb) => {
					const reader: ReadableStreamDefaultReader<Uint8Array> = rb.getReader();

					// let restFromLastTime: any;
					// let deserialized: {
					// 	data: any;
					// 	rest: any;
					// };

					return new ReadableStream({
						cancel: (reason?: any): void => {
							responseStream.error(reason);
							this.activeRequests = this.activeRequests.filter(r => r !== abortController);
						},
						start: (controller: ReadableStreamDefaultController<any>): void => {
							const push: () => void = () => {
								reader.read().then(({ done, value }) => {
									if (done) {
										controller.close();
										responseStream.complete();
										this.activeRequests = this.activeRequests.filter(r => r !== abortController);
										return;
									}
									try {
										// todo: streams: if not binary data then deserialize
										// if (request.constructor[responseTypeSymbol] === ArrayBuffer) {
										responseStream.next(value);
										// } else {
										// 	deserialized = this.config.serializer.deserializePartial(value, restFromLastTime);
										// 	if (deserialized.data?.length) {
										// 		for (const data of deserialized.data) {
										// 			responseStream.next(NaniumObject.create(
										// 				data,
										// 				request.constructor[responseTypeSymbol],
										// 				request.constructor[genericTypesSymbol]
										// 			));
										// 		}
										// 	}
										// 	restFromLastTime = deserialized.rest;
										// }
									} catch (e) {
										this.activeRequests = this.activeRequests.filter(r => r !== abortController);
										controller.close();
										responseStream.error(e);
									}

									// read next portion from stream
									push();
								});
							};

							// start reading from stream
							push();
						},
					});
				});
		};

		core();
	}
}
