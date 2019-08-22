import { Observable, Observer } from 'rxjs';

import { ClientConfig, ServiceManager } from '..';

export class NocatClient implements ServiceManager {
	config: ClientConfig;

	constructor(config?: ClientConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				protocol: 'http',
				exceptionHandler: this.defaultExceptionHandler,
				requestInterceptors: [],
				responseInterceptors: []
			},
			...(config || {})
		};
	}

	async init(): Promise<void> {
		if (window.location.host === 'localhost:4200') {
			this.config.apiUrl = window.location.hostname + ':3000' + this.config.apiUrl;
		} else {
			this.config.apiUrl = window.location.host + this.config.apiUrl;
		}
		this.config.apiUrl = window.location.protocol + '//' + this.config.apiUrl;
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				request = await interceptor.execute(request);
			}
		}

		// execute the request
		let response: any;
		if (this.config.protocol === 'websocket') {
			response = await this.executeWebsocket(serviceName, request);
		} else {
			response = await this.executeHttp(serviceName, request);
		}

		return response;
	}

	private defaultExceptionHandler(response: any): void {
		alert(response);
	}

	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = (): void => {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
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
					this.config.handleException(e);
					observer.error(e);
				});
				xhr.send(JSON.stringify({ [serviceName]: request }));
			};

			// execute request interceptors
			if (this.config.requestInterceptors.length) {
				const promises: Promise<any>[] = [];
				for (const interceptor of this.config.requestInterceptors) {
					promises.push(interceptor.execute(request));
				}
				Promise.all(promises).then(() => core());
			} else {
				core();
			}
		});

	}

	private async executeHttp(serviceName: string, request: any): Promise<any> {
		const xhr: XMLHttpRequest = new XMLHttpRequest();
		const promise: Promise<any> = new Promise<any>((resolve: Function): void => {
			xhr.onload = (): void => {
				if (xhr.status === 200) {
					resolve(xhr.response);
				} else {
					this.config.handleException(xhr.response);
				}
			};
		});
		xhr.open('POST', this.config.apiUrl + '?' + serviceName);
		xhr.send(JSON.stringify({ [serviceName]: request }));

		const result: any = await promise;
		if (result !== null && result !== undefined && result !== '') {
			return JSON.parse(result);
		} else {
			return undefined;
		}
	}

	private async executeWebsocket(serviceName: string, request: any): Promise<any> {
		throw new Error('not yet implemented');
		// todo implement websocket protocol
	}
}
