import { Observable, Observer } from 'rxjs';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';

export interface NocatConsumerBrowserHttpConfig {
	apiUrl?: string;
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	handleError?: (e: any) => Promise<void>;
	isResponsible: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
}

export class NocatConsumerBrowserHttp implements ServiceManager {
	config: NocatConsumerBrowserHttpConfig;

	constructor(config?: NocatConsumerBrowserHttpConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				requestInterceptors: [],
				handleError: (response) => {
					alert(response);
					return Promise.resolve();
				},
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			},
			...(config || {})
		};
	}

	async init(): Promise<void> {
		if (!this.config.apiUrl.startsWith('http')) {
			if (window.location.host === 'localhost:4200') {
				this.config.apiUrl = window.location.hostname + ':3000' + this.config.apiUrl;
			} else {
				this.config.apiUrl = window.location.host + this.config.apiUrl;
			}
			this.config.apiUrl = window.location.protocol + '//' + this.config.apiUrl;
		}
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				request = await interceptor.execute(request, {});
			}
		}

		// execute the request
		return await new Promise<any>((resolve: Function, reject: Function): void => {
			try {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.onabort = (e: any): void => {
					reject(e);
				};
				xhr.onerror = (e: any): void => {
					reject(e);
				};
				xhr.onload = (): void => {
					if (xhr.status === 200) {
						const result: any = xhr.response;
						if (result !== null && result !== undefined && result !== '') {
							resolve(JSON.parse(result));
						} else {
							resolve();
						}
					} else {
						try {
							this.config.handleError(JSON.parse(xhr.response)).then(() => {
							}, (e: any) => {
								reject(e);
							});
						} catch (e) {
							reject(e);
						}
					}
				};
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.send(JSON.stringify({ serviceName, request }));
			} catch (e) {
				reject(e);
			}
		});
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = (): void => {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				let seenBytes: number = 0;
				xhr.onreadystatechange = (): void => {
					if (xhr.readyState === 3) {
						const r: any = JSON.parse(xhr.response.substr(seenBytes));
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
				xhr.send(JSON.stringify({ serviceName, streamed: true, request }));
			};

			// execute request interceptors
			if (this.config.requestInterceptors.length) {
				const promises: Promise<any>[] = [];
				for (const interceptor of this.config.requestInterceptors) {
					promises.push(interceptor.execute(request, {}));
				}
				Promise.all(promises).then(() => core());
			} else {
				core();
			}
		});

	}
}
