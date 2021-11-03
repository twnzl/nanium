import { Observable, Observer } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { NocatJsonSerializer } from '../../serializers/json';
import * as http from 'http';
import { ClientRequest, RequestOptions as HttpRequestOptions } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { URL } from 'url';

export interface NocatConsumerNodejsHttpConfig extends ServiceConsumerConfig {
	apiUrl: string;
	options?: HttpRequestOptions | HttpsRequestOptions;
}

export class NocatConsumerNodejsHttp implements ServiceManager {
	config: NocatConsumerNodejsHttpConfig;

	constructor(config?: NocatConsumerNodejsHttpConfig) {
		this.config = {
			...{
				apiUrl: 'localhost:8080/api',
				proxy: null,
				requestInterceptors: [],
				serializer: new NocatJsonSerializer(),
				handleError: (response) => {
					console.error(response);
					return Promise.resolve();
				},
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

	private async httpRequest(serviceName: string, body: any): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			const uri: URL = new URL(this.config.apiUrl);
			const options: HttpRequestOptions | HttpsRequestOptions = {
				...{
					host: uri.hostname,
					path: uri.pathname + '#' + serviceName,
					port: uri.port,
					method: 'POST',
					protocol: uri.protocol,
				},
				...this.config.options
			};
			let requestFn: (options: HttpRequestOptions | HttpsRequestOptions, callback?: (res: http.IncomingMessage) => void) => ClientRequest;
			if (uri.protocol.startsWith('https')) {
				requestFn = https.request;
			} else {
				requestFn = http.request;
			}
			try {
				const req: ClientRequest = requestFn(options, (response) => {
					let str: string = '';
					response.on('data', (chunk: string) => {
						str += chunk;
					});
					response.on('end', async () => {
						try {
							resolve(await this.config.serializer.deserialize(str));
						} catch (e) {
							reject(e);
						}
					});
				});
				req.write(JSON.stringify(body));
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
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				request = await interceptor.execute(request, {});
			}
		}

		return await this.httpRequest(serviceName, { serviceName, request });
	}


	stream(serviceName: string, request: any): Observable<any> {
		return new Observable<any>((observer: Observer<any>): void => {
			const core: Function = async (): Promise<void> => {
				const xhr: XMLHttpRequest = new XMLHttpRequest();
				xhr.open('POST', this.config.apiUrl + '?' + serviceName);
				let seenBytes: number = 0;
				xhr.onreadystatechange = async (): Promise<void> => {
					if (xhr.readyState === 3) {
						const r: any = await this.config.serializer.deserialize(xhr.response.substr(seenBytes));
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
