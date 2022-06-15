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
import { genericTypesSymbol, NaniumObject, responseTypeSymbol } from '../../objects';
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
		this.httpCore = new HttpCore(this.config, this.httpRequest);
	}


	async init(): Promise<void> {
	}

	async terminate(): Promise<void> {
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	private async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<string> {
		const [baseUri, query]: string[] = url.split('?');
		const uri: URL = new URL(baseUri);
		return new Promise<any>((resolve, reject) => {
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
				const req: ClientRequest = requestFn(options, (response) => {
					let str: string = '';
					response.on('data', (chunk: string) => {
						str += chunk;
					});
					response.on('error', async (e) => {
						reject(e);
					});
					response.on('end', async () => {
						if (response.statusCode === 500) {
							reject(str);
						}
						resolve(str);
					});
				});
				req.on('error', (err) => {
					reject(err);
				});
				if (body) {
					req.write(body);
				}
				req.end();
			} catch (e) {
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

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {

			const core: Function = async (): Promise<void> => {
				// interceptors
				for (const interceptor of this.config.requestInterceptors) {
					await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
				}

				// transmission
				const uri: URL = new URL(this.config.apiUrl);
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
					const req: ClientRequest = requestFn(options, (response) => {
						response.on('data', async (chunk: Buffer) => {
							if (chunk.length > 0) {
								const str: string = chunk.toString('utf8');
								const r: any = NaniumObject.plainToClass(
									await this.config.serializer.deserialize(str),
									request.constructor[responseTypeSymbol],
									request.constructor[genericTypesSymbol]
								);
								observer.next(r);
							}
						});
						response.on('end', async () => {
							observer.complete();
						});
						response.on('error', async (e) => {
							observer.error(e);
						});
					});
					req.write(await this.config.serializer.serialize({ serviceName, streamed: true, request }));
					req.end();
				} catch (e) {
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
