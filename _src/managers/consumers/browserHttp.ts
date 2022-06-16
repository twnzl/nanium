import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { HttpCore } from './http.core';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { genericTypesSymbol, responseTypeSymbol } from '../../objects';

export interface NaniumConsumerBrowserHttpConfig extends ServiceConsumerConfig {
	apiUrl?: string;
	apiEventUrl?: string;
	onServerConnectionRestored?: () => void;
}

export class NaniumConsumerBrowserHttp implements ServiceManager {
	config: NaniumConsumerBrowserHttpConfig;
	private httpCore: HttpCore;
	private activeRequests: XMLHttpRequest[] = [];

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
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
				isResponsibleForEvent: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
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
		for (const xhr of this.activeRequests) {
			xhr.abort();
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
				this.activeRequests.push(xhr);
				let seenBytes: number = 0;
				let deserialized: {
					rest: string;
					data: any;
				} = { data: '', rest: '' };

				const processResponse: (xhr: XMLHttpRequest) => Promise<void> = async (xhr: XMLHttpRequest) => {
					if (xhr.response) {
						try {
							deserialized = await this.config.serializer.getData(
								deserialized.rest + xhr.response.substr(seenBytes),
								request.constructor[responseTypeSymbol],
								request.constructor[genericTypesSymbol]);
						} catch (e) {
							this.activeRequests = this.activeRequests.filter(r => r !== xhr);
							observer.error(e);
						}
					}
					for (const data of deserialized.data) {
						observer.next(data);
					}
					seenBytes = xhr.responseText.length;
				};

				xhr.onreadystatechange = async (): Promise<void> => {
					if (xhr.readyState === 3) {
						await processResponse(xhr);
					} else if (xhr.readyState === 4) {
						await processResponse(xhr);
						this.activeRequests = this.activeRequests.filter(r => r !== xhr);
						observer.complete();
					}
				};
				xhr.addEventListener('error', (e: any) => {
					this.config.handleError(e).then(
						() => {
						},
						(err: any) => {
							this.activeRequests = this.activeRequests.filter(r => r !== xhr);
							observer.error(err);
						});
				});
				xhr.onerror = (evt) => {
					this.activeRequests = this.activeRequests.filter(r => r !== xhr);
					observer.error(evt);
				};
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(await this.config.serializer.serialize({ serviceName, streamed: true, request }));
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
		throw new Error('not yet implemented');
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}

	async httpRequest(method: 'GET' | 'POST', url: string, body?: string, headers?: any): Promise<string> {
		return new Promise<string>((resolve: Function, reject: Function) => {
			let xhr: XMLHttpRequest;
			try {
				xhr = new XMLHttpRequest();
				this.activeRequests.push(xhr);
				xhr.onabort = (e) => {
					this.activeRequests = this.activeRequests.filter(r => r !== xhr);
					reject(e);
				};
				xhr.onerror = (e) => {
					this.activeRequests = this.activeRequests.filter(r => r !== xhr);
					reject(e);
				};
				xhr.onload = async (): Promise<void> => {
					if (xhr.status === 200) {
						this.activeRequests = this.activeRequests.filter(r => r !== xhr);
						if (xhr.response !== undefined && xhr.response !== '') {
							resolve(xhr.response);
						} else {
							resolve();
						}
					} else {
						this.activeRequests = this.activeRequests.filter(r => r !== xhr);
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
				this.activeRequests = this.activeRequests.filter(r => r !== xhr);
				reject(e);
			}
		});
	}
}
