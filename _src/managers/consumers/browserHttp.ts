import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { genericTypesSymbol, NaniumSerializerCore, responseTypeSymbol } from '../../serializers/core';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscriptionInterceptor';
import { HttpCore } from './http.core';

export interface NaniumConsumerBrowserHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl: string;
}

export class NaniumConsumerBrowserHttp implements ServiceManager {
	config: NaniumConsumerBrowserHttpConfig;
	private httpCore: HttpCore;

	constructor(config?: NaniumConsumerBrowserHttpConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				apiEventUrl: '/events',
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					alert(response);
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
		if (!this.config.apiUrl.startsWith('http')) {
			this.config.apiUrl = window.location.protocol + '//' + window.location.host +
				(this.config.apiUrl.startsWith('/') ? '' : '/') + this.config.apiUrl;
		}
		// every consumer instance gets its own unique id from the server and will use it for every subscription.
		// we get this from the server to prevent browser incompatibilities
		this.httpCore.id = await this.httpRequest('GET', this.config.apiEventUrl);
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
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
				const xhr: XMLHttpRequest = new XMLHttpRequest();
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
					this.config.handleError(e).then(
						() => {
						},
						(e: any) => {
							observer.error(e);
						});
				});
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(await this.config.serializer.serialize({ serviceName, streamed: true, request }));
			};

			core();
		});

	}

	async subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<any> {
		await this.httpCore.subscribe(eventConstructor, handler);
	}

	async unsubscribe(eventConstructor: new () => any, handler?: EventHandler): Promise<any> {
		await this.httpCore.unsubscribe(eventConstructor, handler);
	}

	emit(eventName: string, event: any, context: ExecutionContext): any {
		throw new Error('not yet implemented');
	}

	async isResponsibleForEvent(eventName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}

	async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<string> {
		return new Promise<string>((resolve: Function, reject: Function) => {
			try {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.onabort = (e) => {
					reject(e);
				};
				xhr.onerror = (e) => {
					reject(e);
				};
				xhr.onload = async (): Promise<void> => {
					if (xhr.status === 200) {
						if (xhr.response !== undefined && xhr.response !== '') {
							resolve(xhr.response);
						} else {
							resolve();
						}
					} else {
						if (xhr.response !== undefined && xhr.response !== '') {
							reject(xhr.response);
						} else {
							reject();
						}
					}
				};
				xhr.open(method, url);
				for (const key in headers ?? {}) {
					if (headers.hasOwnProperty(key)) {
						xhr.setRequestHeader(key, headers[key]);
					}
				}
				xhr.setRequestHeader('Content-Type', this.config.serializer.mimeType);
				if (method === 'GET') {
					xhr.send();
				} else {
					xhr.send(body);
				}
			} catch (e) {
				reject(e);
			}
		});
	}
}
