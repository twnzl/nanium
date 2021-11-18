import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Observable, Observer } from 'rxjs';
import { RequestChannel } from '../../interfaces/requestChannel';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { LogMode } from '../../interfaces/logMode';
import { Nanium } from '../../core';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
import { StreamServiceExecutor } from '../../interfaces/streamServiceExecutor';
import { ServiceExecutionContext } from '../../interfaces/serviceExecutionContext';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NaniumRepository } from '../../interfaces/serviceRepository';
import { ServiceProviderManager } from '../../interfaces/serviceProviderManager';

export class NaniumNodejsProviderConfig {
	/**
	 * root path where nanium should search for service executor implementations
	 * if not given - no automatic registration of the services is done,
	 * but it can be done manually by using ServiceProviderManager.addService().
	 * This may be useful for unit tests to register MockImplementations for some services
	 */
	servicePath?: string = 'services';

	/**
	 * array of transport adaptors
	 */
	requestChannels?: RequestChannel[] = [];

	/**
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: {
		[name: string]: new() => ServiceRequestInterceptor<any>
	} = {};

	/**
	 * which log output should be made?
	 */
	logMode?: LogMode;

	/**
	 * exception handling function
	 */
	handleError?: (e: Error | any, serviceName: string, request: any, context?: ServiceExecutionContext) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 */
	isResponsible?: (request: any, serviceName: string) => Promise<KindOfResponsibility>;
}


export class NaniumNodejsProvider implements ServiceProviderManager {
	repository: NaniumRepository;
	config: NaniumNodejsProviderConfig = {
		requestInterceptors: {},
		isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
		handleError: async (err: any): Promise<any> => {
			throw err;
		}
	};

	constructor(config: NaniumNodejsProviderConfig) {
		this.config = {
			...this.config,
			...config
		};
		this.repository = {};
	}

	addService<T>(
		requestClass: new () => T,
		executorClass: new () => ServiceExecutor<T, any>
	): void {
		this.repository[(requestClass as any).serviceName] = {
			Executor: executorClass,
			Request: requestClass
		};
	}

	async init(): Promise<void> {

		// init repository
		this.config.servicePath = this.config.servicePath ?? 'services';
		const files: string[] = await findFiles(this.config.servicePath,
			[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.contract.js')]);
		for (const file of files) {
			const request: any = NaniumNodejsProvider.findClassWithServiceNameProperty(require(path.resolve(file)));
			if (!request) {
				if (Nanium.logMode >= LogMode.warning) {
					console.warn('invalid contract file (no request class found): ' + file);
				}
				continue;
			}
			const executor: any = NaniumNodejsProvider.findClassWithServiceNameProperty(
				require(path.resolve(file.replace(/\.contract\.js$/, '.executor.js'))));
			this.addService(request, executor);
			if (Nanium.logMode >= LogMode.info) {
				console.log('service ready: ' + executor.serviceName);
			}
		}

		// init channels over which requests can come from public scope
		if (this.config.requestChannels && this.config.requestChannels.length) {
			for (const channel of this.config.requestChannels) {
				await channel.init(this.repository);
			}
		}
	}

	private static findClassWithServiceNameProperty(module: any): any {
		for (const requestModuleKey in module) {
			if (module[requestModuleKey].hasOwnProperty('serviceName')) {
				return module[requestModuleKey];
			}
		}
	}

	async isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute(serviceName: string, request: any, context?: ServiceExecutionContext): Promise<any> {
		context = context || {};
		let realRequest: any;

		try {
			// validation
			if (this.repository === undefined) {
				return await this.config.handleError(new Error('nanium server is not initialized'), serviceName, request, context);
			}
			if (!this.repository.hasOwnProperty(serviceName)) {
				return await this.config.handleError(new Error('unknown service ' + serviceName), serviceName, request, context);
			}
			if (context?.scope === 'public') {  // private is the default, all adaptors have to set the scope explicitly
				const requestConstructor: any = this.repository[serviceName].Request;
				if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
					return await this.config.handleError(new Error('unauthorized'), serviceName, request, context);
				}
			}

			// if the request comes from a communication channel it is normally a deserialized object,
			// but we need real object that is constructed via the request constructor
			realRequest = new this.repository[serviceName].Request();
			Object.assign(realRequest, request);

			// execution
			if (context?.scope === 'public') {
				await this.executeRequestInterceptors(realRequest, context, this.repository[serviceName].Request);
			}
			const executor: ServiceExecutor<any, any> = new this.repository[serviceName].Executor();
			return await executor.execute(realRequest, context);
		} catch (e) {
			return await this.config.handleError(e, serviceName, request, context);
		}
	}

	stream(serviceName: string, request: any, context?: ServiceExecutionContext): Observable<any> {// validation
		context = context || {};

		if (this.repository === undefined) {
			return this.createErrorObservable(new Error('nanium server is not initialized'));
		}
		if (!this.repository.hasOwnProperty(serviceName)) {
			return this.createErrorObservable(new Error('unknown service ' + serviceName));
		}
		const requestConstructor: any = this.repository[serviceName].Request;
		const realRequest: any = new requestConstructor();
		Object.assign(realRequest, request);
		if (context && context.scope === 'public') { // private is the default, all adaptors have to set the scope explicitly
			if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
				return this.createErrorObservable(new Error('unauthorized'));
			}
		}

		return new Observable<any>((observer: Observer<any>): void => {
			this.executeRequestInterceptors(realRequest, context, this.repository[serviceName].Request).then(() => {
				const executor: StreamServiceExecutor<any, any> = new this.repository[serviceName].Executor();
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
				(Array.isArray(requestType.skipInterceptors) && requestType.skipInterceptors.indexOf(interceptorName) >= 0) ||
				((requestType.skipInterceptors ?? {})[context.scope] === true) ||
				((Array.isArray(requestType.skipInterceptors ?? {})[context.scope]) && requestType.skipInterceptors[context.scope].indexOf(interceptorName) >= 0)
			) {
				continue;
			}
			await new interceptor().execute(request, context);
		}
	}

	// todo: add property requestSource
}
