import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { NaniumJsonSerializer } from '../../serializers/json';
import * as http from 'http';
import { ClientRequest, RequestOptions as HttpRequestOptions } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { genericTypesSymbol, NaniumSerializerCore, responseTypeSymbol } from '../../serializers/core';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscriptionInterceptor';
import { HttpCore } from './http.core';
import { URL } from 'url';

export interface NaniumConsumerNodejsHttpConfig extends ServiceConsumerConfig {
	apiUrl: string;
	apiEventUrl: string;
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
				proxy: null,
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					console.error(response);
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
		// every consumer instance gets its own unique id from the server and will use it for every subscription.
		// we get this from the server to prevent browser incompatibilities
		this.httpCore.id = await this.httpRequest('GET', this.config.apiEventUrl);
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	private async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<string> {
		const uri: URL = new URL(url);
		return new Promise<any>((resolve, reject) => {
			try {
				const options: HttpRequestOptions | HttpsRequestOptions = {
					...{
						host: uri.hostname,
						path: uri.pathname + uri.hash,
						port: uri.port,
						method: method,
						protocol: uri.protocol,
						headers: headers
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
					response.on('end', async () => {
						resolve(str);
					});
				});
				if (body) {
					req.write(body);
				}
				req.end();
			} catch (e) {
				if (e.statusCode === 500) {
					reject(e.error);
				}
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
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				let seenBytes: number = 0;
				xhr.onreadystatechange = async (): Promise<void> => {
					if (xhr.readyState === 3) {
						const r: any = NaniumSerializerCore.plainToClass(
							await this.config.serializer.deserialize(xhr.response.substr(seenBytes)),
							request.constructor[responseTypeSymbol],
							request.constructor[genericTypesSymbol]
						);
						if (Array.isArray(r)) {
							for (const item of r) {
								observer.next(item);
							}
						} else {
							observer.next(r);
						}
						seenBytes = xhr.responseText.length;
					}
				};
				xhr.addEventListener('error', (e: any) => {
					this.config.handleError(e).then(() => {

					});
					observer.error(e);
				});
				xhr.send(await this.config.serializer.serialize({ serviceName, streamed: true, request }));
			};

			core();
		});
	}

	emit(eventName: string, event: any, context: ExecutionContext): void {
	}

	async isResponsibleForEvent(eventName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName);
	}

	async subscribe(eventConstructor: any, handler: EventHandler, retries: number = 0): Promise<void> {
		await this.httpCore.subscribe(eventConstructor, handler);
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
	}
}
