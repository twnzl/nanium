import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { NaniumJsonSerializer } from '../../serializers/json';
import * as http from 'http';
import { ClientRequest, RequestOptions as HttpRequestOptions } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { HttpCore } from './http.core';
import { URL } from 'url';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
import { Nanium } from '../../core';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';

export interface NaniumConsumerNodejsHttpConfig extends ServiceConsumerConfig {
	apiUrl: string;
	apiEventUrl?: string;
	onServerConnectionRestored?: () => void;
	options?: HttpRequestOptions | HttpsRequestOptions;
}

export class NaniumConsumerNodejsHttp implements ServiceManager {
	config: NaniumConsumerNodejsHttpConfig;
	private httpCore: HttpCore;
	private activeRequests: ClientRequest[] = [];

	constructor(config?: NaniumConsumerNodejsHttpConfig) {
		this.config = {
			...{
				apiUrl: 'localhost:8080/api',
				apiEventUrl: 'localhost:8080/events',
				onServerConnectionRestored: () => {
				},
				proxy: null,
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					Nanium.logger.error(response);
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
	}

	async terminate(): Promise<void> {
		for (const xhr of this.activeRequests) {
			xhr.destroy();
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

	private async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<ArrayBuffer> {
		const [baseUri, query]: string[] = url.split('?');
		const uri: URL = new URL(baseUri);
		return new Promise<ArrayBuffer>((resolve, reject) => {
			let req: ClientRequest;
			try {
				const options: HttpRequestOptions | HttpsRequestOptions = {
					...{
						host: uri.hostname,
						path: uri.pathname + (query ? '?' + query : ''),
						port: uri.port,
						method: method,
						protocol: uri.protocol,
						headers: headers,
					},
					...this.config.options
				};
				const requestFn: (options: HttpRequestOptions | HttpsRequestOptions, callback?: (res: http.IncomingMessage) => void) => ClientRequest
					= uri.protocol.startsWith('https') ? https.request : http.request;
				req = requestFn(options, (response) => {
					const chunks: Buffer[] = [];
					// response.setEncoding('binary');
					response.on('data', (chunk: Buffer) => {
						chunks.push(chunk);
					});
					response.on('error', async (e) => {
						this.activeRequests = this.activeRequests.filter(r => r !== req);
						reject(e);
					});
					response.on('end', async () => {
						this.activeRequests = this.activeRequests.filter(r => r !== req);
						let buffer = Buffer.concat(chunks);
						let arrayBuffer: Uint8Array = new Uint8Array(buffer, 0, buffer.length);
						if (response.statusCode === 500) {
							reject(arrayBuffer.buffer);
						}
						resolve(arrayBuffer.buffer);
					});
				});
				req.on('error', (err) => {
					this.activeRequests = this.activeRequests.filter(r => r !== req);
					reject(err);
				});
				if (body) {
					req.write(body);
				}
				this.activeRequests.push(req);
				Nanium.logger.info('active HTTP requests.d ', this.activeRequests);
				req.end();
			} catch (e) {
				this.activeRequests = this.activeRequests.filter(r => r !== req);
				reject(e);
			}
		});
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors?.length) {
			for (const interceptor of this.config.requestInterceptors) {
				await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
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
		return new Promise<NaniumStream<T>>((resolve: Function) => {

			// transmission
			const uri: URL = new URL(this.config.apiUrl);
			let req: ClientRequest;
			try {
				const options: HttpRequestOptions | HttpsRequestOptions = {
					...{
						host: uri.hostname,
						path: uri.pathname + '#' + serviceName,
						port: uri.port,
						method: 'POST',
						protocol: uri.protocol
					},
					...this.config.options
				};
				let restFromLastTime: any;
				let deserialized: {
					data: any;
					rest: any;
				};
				const requestFn: (options: HttpRequestOptions | HttpsRequestOptions, callback?: (res: http.IncomingMessage) => void) => ClientRequest
					= uri.protocol.startsWith('https') ? https.request : http.request;
				req = requestFn(options, (response) => {
					response.on('end', () => {
						resultStream.end();
						return;
					});
					response.on('data', async (chunk: Buffer) => {
						try {
							if (NaniumBuffer.isNaniumBuffer(request.constructor[responseTypeSymbol]?.[1])) {
								resultStream.write(NaniumBuffer.isNaniumBuffer(chunk) ? chunk : new NaniumBuffer(chunk) as any);
							} else {
								deserialized = this.config.serializer.deserializePartial(chunk, restFromLastTime);
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
							this.activeRequests = this.activeRequests.filter(r => r !== req);
							resultStream.error(e);
						}
					});
					response.on('error', err => {
						resultStream.error(err);
					});
				});
				this.activeRequests.push(req);
				req.write(this.config.serializer.serialize({ serviceName, request }));
				req.end();
			} catch (e) {
				this.activeRequests = this.activeRequests.filter(r => r !== req);
				resultStream.error(e);
			}

			resolve(resultStream);
		});
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			let restFromLastTime: any;
			let deserialized: {
				data: any;
				rest: any;
			};

			const core: Function = async (): Promise<void> => {
				// interceptors
				for (const interceptor of this.config.requestInterceptors) {
					await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
				}

				// transmission
				const uri: URL = new URL(this.config.apiUrl);
				let req: ClientRequest;
				try {
					const options: HttpRequestOptions | HttpsRequestOptions = {
						...{
							host: uri.hostname,
							path: uri.pathname + '#' + serviceName,
							port: uri.port,
							method: 'POST',
							protocol: uri.protocol
						},
						...this.config.options
					};
					const requestFn: (options: HttpRequestOptions | HttpsRequestOptions, callback?: (res: http.IncomingMessage) => void) => ClientRequest
						= uri.protocol.startsWith('https') ? https.request : http.request;
					req = requestFn(options, (response) => {
						response.on('data', async (chunk: Buffer) => {
							if (chunk.length > 0) {
								if (
									request.constructor[responseTypeSymbol] === ArrayBuffer ||
									(request.constructor[responseTypeSymbol] && request.constructor[responseTypeSymbol]['naniumBufferInternalValueSymbol'])
								) {
									observer.next(chunk.constructor['naniumBufferInternalValueSymbol'] ? chunk : new NaniumBuffer(chunk));
								} else {
									deserialized = this.config.serializer.deserializePartial(chunk.toString(), restFromLastTime);
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
							}
						});
						response.on('end', async () => {
							this.activeRequests = this.activeRequests.filter(r => r !== req);
							observer.complete();
						});
						response.on('error', async (e) => {
							this.activeRequests = this.activeRequests.filter(r => r !== req);
							observer.error(e);
						});
					});
					this.activeRequests.push(req);
					req.write(this.config.serializer.serialize({ serviceName, streamed: true, request }));
					req.end();
				} catch (e) {
					this.activeRequests = this.activeRequests.filter(r => r !== req);
					observer.error(e);
				}
			};

			core();
		});
	}

	emit(eventName: string, event: any, context: ExecutionContext): void {
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	async subscribe(eventNameOrConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		return await this.httpCore.subscribe(eventNameOrConstructor, handler);
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		await this.httpCore.unsubscribe(subscription, eventName);
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
	}
}
