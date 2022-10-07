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

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors?.length) {
			for (const interceptor of this.config.requestInterceptors) {
				await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
			}
		}

		// execute the request
		return await this.httpCore.sendRequest(serviceName, request);
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = async (): Promise<void> => {
				// interceptors
				for (const interceptor of this.config.requestInterceptors) {
					await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
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
											if (request.constructor[responseTypeSymbol] === ArrayBuffer) {
												observer.next(value);
											} else if (request.constructor[responseTypeSymbol]?.name === NaniumBuffer.name) {
												observer.next(new NaniumBuffer(value));
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

	async unsubscribe(subscription?: EventSubscription): Promise<void> {
		await this.httpCore.unsubscribe(subscription);
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
					if (response.ok) {
						const data: ArrayBuffer = await response.arrayBuffer();
						resolve(data);
					} else {
						reject(await response.arrayBuffer());
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
}
