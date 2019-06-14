import { ServiceManager } from '../interfaces/serviceManager';
import { ClientConfig } from '../interfaces/clientConfig';

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

		// execute response interceptors
		if (this.config.responseInterceptors.length) {
			for (const interceptor of this.config.responseInterceptors) {
				response = await interceptor.execute(response);
			}
		}

		return response;
	}

	private defaultExceptionHandler(response: any): void {
		alert(response);
	}


	private async executeHttp(serviceName: string, request: any): Promise<any> {
		const xhr: XMLHttpRequest = new XMLHttpRequest();
		const promise: Promise<any> = new Promise<any>((resolve: Function): void => {
			xhr.onload = (): void => {
				console.log(xhr);
				if (xhr.status === 200) {
					resolve(xhr.response);
				} else {
					this.config.exceptionHandler(xhr.response);
				}
			};
		});
		xhr.open('POST', this.config.apiUrl + '?' + serviceName);
		xhr.send(JSON.stringify({ [serviceName]: request }));

		const result: any = await promise;
		if (result !== null && result !== undefined) {
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
