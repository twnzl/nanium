import ServiceManager from '../interfaces/serviceManager';
import ClientConfig from '../interfaces/clientConfig';

export default class NocatClient implements ServiceManager {
	config: ClientConfig;

	constructor(config?: ClientConfig) {
		this.config = {
			...{
				apiUrl: '/api'
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
		const xhr: XMLHttpRequest = new XMLHttpRequest();
		const promise: Promise<any> = new Promise<any>((resolve: Function, reject: Function): void => {
			xhr.onload = function (): void {
				console.log(xhr);
				if (xhr.status === 200) {
					resolve(xhr.response);
				} else {
					reject(xhr);
				}
			};
		});
		xhr.open('POST', this.config.apiUrl + '?' + serviceName);
		xhr.send(JSON.stringify({ [serviceName]: request }));
		return await promise;
	}

	// todo changeable Protokoll (http, websocket)
}
