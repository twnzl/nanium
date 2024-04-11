import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { HttpCore } from './http.core';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';

export interface NaniumConsumerBrowserHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl?: string;
	onServerConnectionRestored?: () => void;
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
			},
			...(config || {})
		};
		this.httpCore = new HttpCore(this.config,
			async (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => await this.httpRequest(method, url, body, headers));
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
			async (method: 'GET' | 'POST', url: string, body?: string, headers?: any) => await this.httpRequest(method, url, body, headers));
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
		let response: any;
		if (
			NaniumStream.isNaniumStream(request.constructor[responseTypeSymbol]) ||
			NaniumStream.isNaniumStream(request.constructor[responseTypeSymbol]?.[0])
		) {
			response = await this.stream_new(serviceName, request);
		} else {
			response = await this.httpCore.sendRequest(serviceName, request);
		}

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

	async stream_new<T = any>(serviceName: string, request: any): Promise<NaniumStream<T>> {
		const streamItemConstructor = request.constructor[responseTypeSymbol]?.[1];
		const resultStream: NaniumStream<T> = new NaniumStream(streamItemConstructor);

		// transmission
		const abortController: AbortController = new AbortController();
		this.activeRequests.push(abortController);
		const req: Request = new Request(this.config.apiUrl + '?' + serviceName, {
			method: 'post',
			mode: 'cors',
			redirect: 'follow',
			body: this.config.serializer.serialize({ serviceName, request }),
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
						resultStream.error(reason);
						this.activeRequests = this.activeRequests.filter(r => r !== abortController);
					},
					start: (controller: ReadableStreamDefaultController<any>): void => {
						const push: () => void = () => {
							reader.read().then(({ done, value }) => {
								if (done) {
									controller.close();
									resultStream.end();
									this.activeRequests = this.activeRequests.filter(r => r !== abortController);
									return;
								}
								try {
									if (NaniumBuffer.isNaniumBuffer(request.constructor[responseTypeSymbol]?.[1])) {
										resultStream.write(NaniumBuffer.isNaniumBuffer(value) ? value : new NaniumBuffer(value) as any);
									} else {
										deserialized = this.config.serializer.deserializePartial(value, restFromLastTime);
										if (deserialized.data?.length) {
											for (const data of deserialized.data) {
												resultStream.write(NaniumObject.create(
													data,
													streamItemConstructor,
													request.constructor[genericTypesSymbol]
												));
											}
										}
										restFromLastTime = deserialized.rest;
									}
								} catch (e) {
									this.activeRequests = this.activeRequests.filter(r => r !== abortController);
									controller.close();
									resultStream.error(e);
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

		return resultStream;
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

	// async httpRequest_old(method: 'GET' | 'POST', url: string, body?: string | ArrayBuffer | FormData, headers?: any): Promise<ArrayBuffer> {
	// 	return new Promise<ArrayBuffer>((resolve: Function, reject: Function) => {
	// 		let xhr: XMLHttpRequest;
	// 		try {
	// 			xhr = new XMLHttpRequest();
	// 			this.activeRequests.push(xhr);
	// 			xhr.onabort = (e) => {
	// 				this.activeRequests = this.activeRequests.filter(r => r !== xhr);
	// 				reject(e);
	// 			};
	// 			xhr.onerror = (e) => {
	// 				this.activeRequests = this.activeRequests.filter(r => r !== xhr);
	// 				reject(e);
	// 			};
	// 			xhr.onload = async (): Promise<void> => {
	// 				if (xhr.status === 200) {
	// 					this.activeRequests = this.activeRequests.filter(r => r !== xhr);
	// 					if (xhr.response !== undefined && xhr.response !== '') {
	// 						resolve(xhr.response);
	// 					} else {
	// 						resolve();
	// 					}
	// 				} else {
	// 					this.activeRequests = this.activeRequests.filter(r => r !== xhr);
	// 					if (xhr.response !== undefined && xhr.response !== '') {
	// 						reject(xhr.response);
	// 					} else {
	// 						reject();
	// 					}
	// 				}
	// 			};
	// 			xhr.open(method, url);
	// 			for (const key in headers ?? {}) {
	// 				if (headers.hasOwnProperty(key)) {
	// 					xhr.setRequestHeader(key, headers[key]);
	// 				}
	// 			}
	// 			xhr.setRequestHeader('Content-Type', this.config.serializer.mimeType);
	// 			if (method === 'GET') {
	// 				xhr.send();
	// 			} else {
	// 				xhr.send(body);
	// 			}
	// 		} catch (e) {
	// 			this.activeRequests = this.activeRequests.filter(r => r !== xhr);
	// 			reject(e);
	// 		}
	// 	});
	// }
}
