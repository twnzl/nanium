import ServiceManager from '../interfaces/serviceManager';
import ClientConfig from '../interfaces/clientConfig';

export default class NocatClient implements ServiceManager {
	config: ClientConfig;

	constructor(config?: ClientConfig) {
		this.config = {
			...{
				apiUrl: '/api',
				protocol: 'http',
				exceptionHandler: this.defaultExceptionHandler
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
		if (this.config.protocol === 'websocket') {
			return await this.executeWebsocket(serviceName, request);
		} else {
			return await this.executeHttp(serviceName, request);
		}
	}

	private defaultExceptionHandler(response: any): void {
		alert(response);
	}


	private async executeHttp(serviceName: string, request: any): Promise<any> {
		const xhr: XMLHttpRequest = new XMLHttpRequest();
		const promise: Promise<any> = new Promise<any>((resolve: Function, reject: Function): void => {
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
		return await promise;
	}

	private async executeWebsocket(serviceName: string, request: any): Promise<any> {
		throw new Error('not yet implemented');
		// todo implement websocket protocol
	}
}
