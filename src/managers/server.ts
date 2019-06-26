import { Stats } from 'fs';
import * as findFiles from 'recursive-readdir';
import * as path from 'path';
import { ServiceExecutor } from '../interfaces/serviceExecutor';
import { ServiceManager } from '../interfaces/serviceManager';
import { LogMode, ServerConfig } from '../interfaces/serverConfig';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../interfaces/streamServiceExecutor';

let repository: { [serviceName: string]: any };

export class NocatServer implements ServiceManager {
	config: ServerConfig = {
		servicePath: 'services',
		requestInterceptors: [],
		logMode: LogMode.error,
		handleException: async (err: any): Promise<any> => {
			throw err;
		}
	};

	constructor(config: ServerConfig) {
		this.config = {
			...this.config,
			...config
		};
		repository = {};
	}

	async init(): Promise<void> {
		const files: string[] = await findFiles(this.config.servicePath,
			[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.js')]);
		for (const file of files) {
			const executor: { serviceName: string } = require(path.resolve(file)).default;
			repository[executor.serviceName] = executor;
			if (this.config.logMode >= LogMode.info) {
				console.log('service ready: ' + executor.serviceName);
			}
		}
	}

	async execute(serviceName: string, request: any): Promise<any> {
		try {
			// validation
			if (repository === undefined) {
				return this.config.handleException(new Error('nocat server is not initialized'));
			}
			if (!repository.hasOwnProperty(serviceName)) {
				return this.config.handleException(new Error('unknown service ' + serviceName));
			}

			request = await this.executeRequestInterceptors(request);

			// execute the request
			const executor: ServiceExecutor<any, any> = new repository[serviceName]();
			return await executor.execute(request);

		} catch (e) {
			return this.config.handleException(e);
		}
	}

	stream(serviceName: string, request: any): Observable<any> {// validation
		if (repository === undefined) {
			return this.createErrorObservable(new Error('nocat server is not initialized'));
		}
		if (!repository.hasOwnProperty(serviceName)) {
			return this.createErrorObservable(Error('unknown service ' + serviceName));
		}

		return new Observable<any>((observer: Observer<any>): void => {
			this.executeRequestInterceptors(request).then((request: any) => {
				const executor: StreamServiceExecutor<any, any> = new repository[serviceName]();
				executor.execute(request).subscribe({
					next: (value: any): void => {
						observer.next(value);
					},
					error: (e: any): void => {
						this.config.handleException(e).then();
						observer.error(e);
					},
					complete: (): void => {
						observer.complete();
					}
				});
			});
		});
	}

	private createErrorObservable(e: any): Observable<any> {
		return new Observable((observer: Observer<any>): void => {
			observer.error(e);
		});
	}

	/**
	 * execute request interceptors
	 */
	private async executeRequestInterceptors(request: any): Promise<any> {
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				request = await interceptor.execute(request);
			}
		}
		return request;
	}

	// todo queues
	// todo add property requestSource setzen
	// todo im executor auch nur body zurück geben muss möglich sein
}
