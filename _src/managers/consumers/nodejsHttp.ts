import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
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
import { genericTypesSymbol, responseTypeSymbol } from '../../objects';
import { Nanium } from '../../core';

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
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
				isResponsibleForEvent: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
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

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	private async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<string> {
		const [baseUri, query]: string[] = url.split('?');
		const uri: URL = new URL(baseUri);
		return new Promise<any>((resolve, reject) => {
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
					let str: string = '';
					response.on('data', (chunk: string) => {
						str += chunk;
					});
					response.on('error', async (e) => {
						this.activeRequests = this.activeRequests.filter(r => r !== req);
						reject(e);
					});
					response.on('end', async () => {
						this.activeRequests = this.activeRequests.filter(r => r !== req);
						if (response.statusCode === 500) {
							reject(str);
						}
						resolve(str);
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

		return await this.httpCore.sendRequest(serviceName, request);
	}

	// todo: with node version 8 (fetch-api) this can be the same code as in browserHttp
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
								deserialized = this.config.serializer.deserializePartial(
									chunk.toString(),
									request.constructor[responseTypeSymbol],
									request.constructor[genericTypesSymbol],
									restFromLastTime
								);
								if (deserialized.data?.length) {
									for (const data of deserialized.data) {
										observer.next(data);
									}
								}
								restFromLastTime = deserialized.rest;
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

	async isResponsibleForEvent(eventName: string, context?: any): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	async subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<EventSubscription> {
		return await this.httpCore.subscribe(eventConstructor, handler);
	}

	async unsubscribe(subscription?: EventSubscription): Promise<void> {
		await this.httpCore.unsubscribe(subscription);
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
	}
}
