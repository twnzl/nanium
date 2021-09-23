import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Observable, Observer } from 'rxjs';
import { RequestChannel } from '../../interfaces/requestChannel';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { LogMode } from '../../interfaces/logMode';
import { ServiceManager } from '../../interfaces/serviceManager';
import { Nocat } from '../../core';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
import { StreamServiceExecutor } from '../../interfaces/streamServiceExecutor';
import { ServiceExecutionContext } from '../../interfaces/serviceExecutionContext';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NocatRepository } from '../../interfaces/serviceRepository';

export interface NocatNodejsProviderConfig {
	/**
	 * root path where nocat should searches for service executor implementations (default: /service)
	 */
	servicePath: string;

	/**
	 * array of transport adaptors
	 */
	requestChannels?: RequestChannel[];

	/**
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: {
		[name: string]: new() => ServiceRequestInterceptor<any>
	};

	/**
	 * which log output should be made?
	 */
	logMode?: LogMode;

	/**
	 * exception handling function
	 */
	handleError: (e: Error | any, serviceName: string, request: any, context?: ServiceExecutionContext) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 */
	isResponsible: (serviceName: string) => KindOfResponsibility;
}

let repository: NocatRepository;

export class NocatNodejsProvider implements ServiceManager {
	config: NocatNodejsProviderConfig = {
		servicePath: 'services',
		requestInterceptors: {},
		isResponsible: (): KindOfResponsibility => 'yes',
		handleError: async (err: any): Promise<any> => {
			throw err;
		}
	};

	constructor(config: NocatNodejsProviderConfig) {
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
			const request: any = require(path.resolve(file.replace(/\.executor\.js$/, '.contract.js')))[executor.serviceName.split('.')[1] + 'Request'];
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

	isResponsible(serviceName: string): KindOfResponsibility {
		return this.config.isResponsible(serviceName);
	}

	async execute(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any> {
		context = context || {};
		const realRequest: any = new repository[serviceName].Request();
		Object.assign(realRequest, request);

		try {
			// validation
			if (repository === undefined) {
				return await this.config.handleError(new Error('nocat server is not initialized'), serviceName, realRequest, context);
			}
			if (!repository.hasOwnProperty(serviceName)) {
				return await this.config.handleError(new Error('unknown service ' + serviceName), serviceName, realRequest, context);
			}
			if (context?.scope === 'public') {  // private is the default, all adaptors have to set the scope explicitly
				const requestConstructor: any = repository[serviceName].Request;
				if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
					return await this.config.handleError(new Error('unauthorized'), serviceName, realRequest, context);
				}
			}

			// execution
			if (context?.scope === 'public') {
				await this.executeRequestInterceptors(realRequest, context, repository[serviceName].Request);
			}
			const executor: ServiceExecutor<any, any> = new repository[serviceName].Executor();
			return await executor.execute(realRequest, context);
		} catch (e) {
			return await this.config.handleError(e, serviceName, realRequest, context);
		}
	}

	stream(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any> {// validation
		context = context || {};
		const realRequest: any = new repository[serviceName].Request();
		Object.assign(realRequest, request);

		if (repository === undefined) {
			return this.createErrorObservable(new Error('nocat server is not initialized'));
		}
		if (!repository.hasOwnProperty(serviceName)) {
			return this.createErrorObservable(new Error('unknown service ' + serviceName));
		}
		if (context && context.scope === 'public') { // private is the default, all adaptors have to set the scope explicitly
			const requestConstructor: any = repository[serviceName].Request;
			if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
				return this.createErrorObservable(new Error('unauthorized'));
			}
		}

		return new Observable<any>((observer: Observer<any>): void => {
			this.executeRequestInterceptors(realRequest, context, repository[serviceName].Request).then(() => {
				const executor: StreamServiceExecutor<any, any> = new repository[serviceName].Executor();
				executor.stream(realRequest, context).subscribe({
					next: (value: any): void => {
						observer.next(value);
					},
					error: (e: any): void => {
						this.config.handleError(e, serviceName, realRequest, context).then();
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
		for (const interceptorName of Object.keys(this.config.requestInterceptors)) {
			const interceptor: new() => ServiceRequestInterceptor<any> = this.config.requestInterceptors[interceptorName];
			if (
				requestType.skipInterceptors === true ||
				(Array.isArray(requestType.skipInterceptors) && requestType.skipInterceptors.indexOf(interceptorName) >= 0)
			) {
				continue;
			}
			await new interceptor().execute(request, context);
		}
	}

	// todo queues
	// todo add property requestSource setzen
	// todo im executor auch nur body zurück geben muss möglich sein
}
