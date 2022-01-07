import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Observable, Observer } from 'rxjs';
import { Channel } from '../../interfaces/channel';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { LogMode } from '../../interfaces/logMode';
import { Nanium } from '../../core';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
import { StreamServiceExecutor } from '../../interfaces/streamServiceExecutor';
import { ExecutionContext } from '../../interfaces/executionContext';
import { KindOfResponsibility } from '../../interfaces/kindOfResponsibility';
import { NaniumRepository } from '../../interfaces/serviceRepository';
import { ServiceProviderManager } from '../../interfaces/serviceProviderManager';
import { ServiceProviderConfig } from '../../interfaces/serviceProviderConfig';
import { EventHandler } from '../../interfaces/eventHandler';
import {
	EventEmissionSendInterceptor,
	EventSubscriptionReceiveInterceptor
} from '../../interfaces/eventSubscriptionInterceptor';
import { EventSubscription } from '../../interfaces/eventSubscription';

export class NaniumNodejsProviderConfig implements ServiceProviderConfig {
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
	channels?: Channel[] = [];

	/**
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: (ServiceRequestInterceptor<any> | (new() => ServiceRequestInterceptor<any>))[];

	/**
	 * which log output should be made?
	 */
	logMode?: LogMode;

	/**
	 * exception handling function
	 */
	handleError?: (e: Error | any, serviceName: string, request: any, context?: ExecutionContext) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 */
	isResponsible?: (request: any, serviceName: string) => Promise<KindOfResponsibility>;

	/**
	 * returns if the Manager is responsible for the given eventName
	 * @param eventName
	 */
	isResponsibleForEvent?: (eventName: string) => Promise<KindOfResponsibility>;

	/**
	 * event subscription interceptors
	 * code that runs if a subscription request has been received, to check acceptance
	 * and add data to the subscription context
	 */
	eventSubscriptionReceiveInterceptors?: (EventSubscriptionReceiveInterceptor<any> | (new() => EventSubscriptionReceiveInterceptor<any>))[];

	/**
	 * event emission interceptors
	 * code that runs if an event occurs, to check to which subscriber this event must be emitted
	 */
	eventEmissionSendInterceptors?: (EventEmissionSendInterceptor<any> | (new() => EventEmissionSendInterceptor<any>))[];
}


export class NaniumNodejsProvider implements ServiceProviderManager {
	repository: NaniumRepository;
	internalEventSubscriptions: { [eventName: string]: ((event: any) => void)[] } = {};
	config: NaniumNodejsProviderConfig = {
		requestInterceptors: [],
		isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
		isResponsibleForEvent: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
		handleError: async (err: any): Promise<any> => {
			throw err;
		}
	};

	// private eventSubscriptions: { [clientId: string]: ProviderEventSubscriptionInfo } = {};

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
		if (this.config.servicePath) {
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
		}

		// init channels over which requests can come from public scope
		if (this.config.channels && this.config.channels.length) {
			for (const channel of this.config.channels) {
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

	async execute(serviceName: string, request: any, context?: ExecutionContext): Promise<any> {
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

	stream(serviceName: string, request: any, context?: ExecutionContext): Observable<any> {// validation
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
	private async executeRequestInterceptors(request: any, context: ExecutionContext, requestType: any): Promise<void> {
		if (!this.config.requestInterceptors?.length) {
			return;
		}
		for (const interceptor of this.config.requestInterceptors) {
			if (
				requestType.skipInterceptors === true ||
				(Array.isArray(requestType.skipInterceptors) && !requestType.skipInterceptors.includes(interceptor)) ||
				((requestType.skipInterceptors ?? {})[context.scope] === true) ||
				((Array.isArray(requestType.skipInterceptors ?? {})[context.scope]) && !requestType.skipInterceptors[context.scope].includes(interceptor))
			) {
				continue;
			}
			await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, context);
		}
	}

	async emit(eventName: string, event: any, executionContext: ExecutionContext): Promise<void> {
		let emissionOk: boolean;
		const interceptors: EventEmissionSendInterceptor<any>[] = this.config.eventEmissionSendInterceptors?.map(
			(instanceOrClass) => typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass
		) ?? [];
		for (const channel of this.config.channels) { // channels
			if (!channel.eventSubscriptions) {
				continue;
			}
			for (const subscription of channel.eventSubscriptions[eventName] ?? []) { // subscriptions
				emissionOk = true;
				for (const interceptor of interceptors) { // interceptors
					emissionOk = await interceptor.execute(event, executionContext, subscription);
					if (!emissionOk) {
						break;
					}
				}
				if (emissionOk) {
					channel.emitEvent(event, subscription).then();
				}
			}
		}
		// internal
		if (this.internalEventSubscriptions[eventName]?.length) {
			const subscription: EventSubscription = new EventSubscription('', eventName);
			emissionOk = true;
			for (const interceptor of interceptors) { // interceptors
				emissionOk = await interceptor.execute(event, executionContext, subscription);
				if (!emissionOk) {
					break;
				}
			}
			if (emissionOk) {
				for (const handler of this.internalEventSubscriptions[eventName]) {
					handler(event);
				}
			}
		}
	}

	async isResponsibleForEvent(eventName: string): Promise<KindOfResponsibility> {
		return await this.config.isResponsibleForEvent(eventName);
	}

	async subscribe(eventConstructor: new() => any, handler: EventHandler): Promise<EventSubscription> {
		const eventName: string = (eventConstructor as any).eventName;
		this.internalEventSubscriptions[eventName] =
			this.internalEventSubscriptions[eventName] ?? [];
		this.internalEventSubscriptions[eventName].push(handler);
		return new EventSubscription('', eventName, handler);
	}

	async unsubscribe(eventConstructor: any, handler?: (data: any) => Promise<void>): Promise<void> {
		const eventName: string = (eventConstructor as any).eventName;
		if (handler) {
			this.internalEventSubscriptions[eventName] = this.internalEventSubscriptions[eventName].filter(h => h !== handler);
		} else {
			delete this.internalEventSubscriptions[eventName];
		}
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		if (this.config.eventSubscriptionReceiveInterceptors?.length) {
			let interceptor: EventSubscriptionReceiveInterceptor<any>;
			for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
				interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
				try {
					await interceptor.execute(subscriptionData);
				} catch (e) {
					throw e;
				}
			}
		}
	}
}
