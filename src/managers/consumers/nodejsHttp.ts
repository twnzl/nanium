import { Observable, Observer } from 'rxjs';
import { RequestPromiseOptions } from 'request-promise';
import { UrlOptions } from 'request';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';

export interface NocatConsumerNodejsHttpConfig {
	apiUrl?: string;
	proxy?: string;
	requestInterceptors?: ServiceRequestInterceptor<any>[];
	handleError?: (e: any) => Promise<void>;
	isResponsible: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
}

export class NocatConsumerNodejsHttp implements ServiceManager {
	config: NocatConsumerNodejsHttpConfig;

	constructor(config?: NocatConsumerNodejsHttpConfig) {
		this.config = {
			...{
				apiUrl: 'localhost:8080/api',
				proxy: null,
				exceptionHandler: (response) => console.error(response),
				requestInterceptors: [],
				isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			},
			...(config || {})
		};
	}

	async init(): Promise<void> {
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	private static _httpRequest: Function;
	private static get httpRequest(): Function {
		return this._httpRequest || (this._httpRequest = require('request-promise-native'));
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				request = await interceptor.execute(request, {});
			}
		}

		// execute the request
		const options: UrlOptions & RequestPromiseOptions = {
			url: this.config.apiUrl + '#' + serviceName,
			method: 'post',
			json: true,
			body: { serviceName, request }
		};
		if (this.config.proxy) {
			options.proxy = this.config.proxy;
			options.rejectUnauthorized = false;
		}
		try {
			return await NocatConsumerNodejsHttp.httpRequest(options);
		} catch (e) {
			if (e.statusCode === 500) {
				throw e.error;
			}
			throw e;
		}
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
					this.config.handleError(e).then(() => {

					});
					observer.error(e);
				});
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
