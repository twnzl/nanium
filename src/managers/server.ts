import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Observable, Observer } from 'rxjs';

import {
	LogMode,
	Nocat,
	ServerConfig,
	ServiceExecutionContext,
	ServiceExecutionScope,
	ServiceExecutor,
	ServiceManager,
	StreamServiceExecutor
} from '..';

export class NocatRepository {
	[serviceName: string]: {
		Executor: any, // upper case because it are constructors
		Request: any
	}
}

let repository: NocatRepository;

export class NocatServer implements ServiceManager {
	config: ServerConfig = {
		servicePath: 'services',
		requestInterceptors: [],
		handleError: async (err: any): Promise<any> => {
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

		// init repository
		const files: string[] = await findFiles(this.config.servicePath,
			[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.js')]);
		for (const file of files) {
			const executor: any = require(path.resolve(file)).default;
			const request: any = require(path.resolve(file.replace(/\.executor\.js$/, '.contract.js')))[executor.serviceName + 'Request'];
			repository[executor.serviceName] = {
				Executor: executor,
				Request: request
			};
			if (Nocat.logMode >= LogMode.info) {
				console.log('service ready: ' + executor.serviceName);
			}
		}

		// init channels over which requests can come from public scope
		if (this.config.requestChannels && this.config.requestChannels.length) {
			for (const channel of this.config.requestChannels) {
				await channel.init(repository);
			}
		}
	}

	async execute(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any> {
		context = context || {};

		try {
			// validation
			if (repository === undefined) {
				return await this.config.handleError(new Error('nocat server is not initialized'));
			}
			if (!repository.hasOwnProperty(serviceName)) {
				return await this.config.handleError(new Error('unknown service ' + serviceName));
			}
			if (context && context.scope === ServiceExecutionScope.public) {  // private is the default, all adaptors have to set the scope explicitly
				const requestConstructor: any = repository[serviceName].Request;
				if (!requestConstructor.scope || requestConstructor.scope !== ServiceExecutionScope.public) {
					return await this.config.handleError(new Error('unauthorized'));
				}
			}

			// execution
			await this.executeRequestInterceptors(request, context, repository[serviceName].Request);
			const executor: ServiceExecutor<any, any> = new repository[serviceName].Executor();
			return await executor.execute(request, context);
		} catch (e) {
			return await this.config.handleError(e);
		}
	}

	stream(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any> {// validation
		context = context || {};
		if (repository === undefined) {
			return this.createErrorObservable(new Error('nocat server is not initialized'));
		}
		if (!repository.hasOwnProperty(serviceName)) {
			return this.createErrorObservable(new Error('unknown service ' + serviceName));
		}
		if (context && context.scope === ServiceExecutionScope.public) { // private is the default, all adaptors have to set the scope explicitly
			const requestConstructor: any = repository[serviceName].Request;
			if (!requestConstructor.scope || requestConstructor.scope !== ServiceExecutionScope.public) {
				return this.createErrorObservable(new Error('unauthorized'));
			}
		}

		return new Observable<any>((observer: Observer<any>): void => {
			this.executeRequestInterceptors(request, context, repository[serviceName].Request).then(() => {
				const executor: StreamServiceExecutor<any, any> = new repository[serviceName].Executor();
				executor.stream(request, context).subscribe({
					next: (value: any): void => {
						observer.next(value);
					},
					error: (e: any): void => {
						this.config.handleError(e).then();
						observer.error(e);
					},
					complete: (): void => {
						observer.complete();
					}
				});
			});
		});
	}

	isStream(serviceName: string): boolean {
		return !!repository[serviceName].Executor.prototype.stream;
	}

	private createErrorObservable(e: any): Observable<any> {
		return new Observable((observer: Observer<any>): void => {
			observer.error(e);
		});
	}

	/**
	 * execute request interceptors
	 */
	private async executeRequestInterceptors(request: any, context: ServiceExecutionContext, requestType: any): Promise<void> {
		if (this.config.requestInterceptors.length) {
			for (const interceptor of this.config.requestInterceptors) {
				if (
					requestType.skipInterceptors === true ||
					(Array.isArray(requestType.skipInterceptors) && requestType.skipInterceptors.indexOf(interceptor) >= 0)
				) {
					continue;
				}
				await new interceptor().execute(request, context);
			}
		}
	}

	// todo queues
	// todo add property requestSource setzen
	// todo im executor auch nur body zurück geben muss möglich sein
}
