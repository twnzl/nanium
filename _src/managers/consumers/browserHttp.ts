import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ExecutionContext } from '../../interfaces/executionContext';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ServiceManager } from '../../interfaces/serviceManager';
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
import { NaniumJsonSerializer } from '../../serializers/json';
import { getPrimaryResponseType } from '../core';
import { HttpCore } from './http.core';

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
			async (method: 'GET' | 'POST', url: string, body?: string | ArrayBuffer | FormData, headers?: any) => await this.httpRequest(method, url, body, headers));
	}

	async init(): Promise<void> {
		if (!this.config.apiUrl.startsWith('http')) {
			this.config.apiUrl = window.location.protocol + '//' + window.location.host +
				(this.config.apiUrl.startsWith('/') ? '' : '/') + this.config.apiUrl;
		}
	}

	async terminate(): Promise<void> {
		for (const ar of this.activeRequests) {
			try {
				ar.abort();
			} catch {
			}
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
		let ResponseType = getPrimaryResponseType(request);
		let response: any;
		if (NaniumStream.isNaniumStream(ResponseType)) {
			response = await this.stream(serviceName, request);
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

	async stream<T = any>(serviceName: string, request: any): Promise<NaniumStream<T>> {
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
							reader.read().then(async ({ done, value }) => {
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

	async subscribe(eventNameOrConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		return await this.httpCore.subscribe(eventNameOrConstructor, handler, context);
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		await this.httpCore.unsubscribe(subscription, eventName);
	}

	async removeClient(_clientId: string): Promise<void> {
	}

	emit(_eventName: string, _event: any, _context: ExecutionContext): any {
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}

	async httpRequest(method: 'GET' | 'POST', url: string, body?: string | ArrayBuffer | FormData, headers?: any): Promise<ArrayBufferView> {
		return new Promise<ArrayBufferView>((resolve: Function, reject: Function) => {
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
}
