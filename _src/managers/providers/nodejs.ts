import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Observable, Observer } from 'rxjs';
import { Channel } from '../../interfaces/channel';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { Nanium } from '../../core';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
import { StreamServiceExecutor } from '../../interfaces/streamServiceExecutor';
import { ExecutionContext } from '../../interfaces/executionContext';
import { NaniumRepository } from '../../interfaces/serviceRepository';
import { ServiceProviderManager } from '../../interfaces/serviceProviderManager';
import { ServiceProviderConfig } from '../../interfaces/serviceProviderConfig';
import { EventHandler } from '../../interfaces/eventHandler';
import {
	EventEmissionSendInterceptor,
	EventSubscriptionReceiveInterceptor
} from '../../interfaces/eventSubscriptionInterceptor';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { genericTypesSymbol, NaniumObject } from '../../objects';

export class NaniumNodejsProviderConfig implements ServiceProviderConfig {
	/**
	 * root path where nanium should search for service executor implementations
	 * if not given - no automatic registration of the services is done,
	 * but it can be done manually by using ServiceProviderManager.addService().
	 * This may be useful for unit tests to register MockImplementations for some services
	 */
	servicePath?: string = 'services';

	/**
	 * array of channels for incoming requests
	 * !do not change this collection after the manager has been initialized (that means after calling Nanium.addManager())!
	 */
	channels?: Channel[] = [];

	/**
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: (ServiceRequestInterceptor<any> | (new() => ServiceRequestInterceptor<any>))[];

	/**
	 * exception handling function
	 */
	handleError?: (e: Error | any, serviceName: string, request: any, context?: ExecutionContext) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 * 0 means not responsible and >0 means responsible, with the rule that the one with the highest number wins
	 */
	isResponsible?: (request: any, serviceName: string) => Promise<number>;

	/**
	 * returns if the Manager is responsible for the given eventName
	 * manager with the highest values above 0 wins
	 * @param eventName
	 * @param context
	 */
	isResponsibleForEvent?: (eventName: string, context?: any) => Promise<number>;

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


export class NaniumProviderNodejs implements ServiceProviderManager {
	repository: NaniumRepository;
	internalEventSubscriptions: { [eventName: string]: EventSubscription[] } = {};
	config: NaniumNodejsProviderConfig = {
		servicePath: 'services',
		requestInterceptors: [],
		isResponsible: async (): Promise<number> => Promise.resolve(1),
		isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
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
		for (const channel of this.config.channels ?? []) {
			channel.manager = this;
		}
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

	addChannel<T>(channel: Channel): void {
		channel.init(this.repository, this).then();
		this.config.channels = this.config.channels ?? [];
		this.config.channels.push(channel);
	}

	async init(): Promise<void> {

		// init repository
		if (this.config.servicePath) {
			let files: string[];
			try {
				files = await findFiles(path.resolve(this.config.servicePath),
					[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.contract.js')]);
			} catch (e) {
				Nanium.logger.error(e);
				throw new Error('nanium: service path does not exist. Please specify an absolute path (or relative to the working directory) to the property "servicePath" when initializing NaniumProviderNodejs');
			}
			for (const file of files) {
				try {
					const request: any = NaniumProviderNodejs.findClassWithServiceNameProperty(require(path.resolve(file)));
					if (!request) {
						Nanium.logger.warn('invalid contract file (no request class found): ' + file);
						continue;
					}
					const executor: any = NaniumProviderNodejs.findClassWithServiceNameProperty(
						require(path.resolve(file.replace(/\.contract\.js$/, '.executor.js'))));
					this.addService(request, executor);
					Nanium.logger.info('service ready: ' + executor.serviceName);
				} catch (e) {
					Nanium.logger.error(e);
					throw e;
				}
			}
		}

		// init channels over which requests can come from public scope
		if (this.config.channels && this.config.channels.length) {
			for (const channel of this.config.channels) {
				await channel.init(this.repository, this);
			}
		}
	}

	async terminate(): Promise<void> {
	}

	private static findClassWithServiceNameProperty(module: any): any {
		for (const requestModuleKey in module) {
			if (module[requestModuleKey].hasOwnProperty('serviceName')) {
				return module[requestModuleKey];
			}
		}
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
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
			if (!Object.prototype.hasOwnProperty.call(this.repository, serviceName)) {
				return await this.config.handleError(new Error('unknown service ' + serviceName), serviceName, request, context);
			}
			const requestConstructor: any = this.repository[serviceName].Request;
			if (context?.scope === 'public') {  // private is the default, all adaptors have to set the scope explicitly
				if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
					return await this.config.handleError(new Error('unauthorized'), serviceName, request, context);
				}
			}

			// if the request comes from a communication channel it is normally a deserialized object,
			// but we need real object that is constructed via the request constructor
			realRequest = NaniumObject.create(
				request,
				requestConstructor,
				requestConstructor[genericTypesSymbol]);

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
		if (!Object.prototype.hasOwnProperty.call(this.repository, serviceName)) {
			return this.createErrorObservable(new Error('unknown service ' + serviceName));
		}
		const requestConstructor: any = this.repository[serviceName].Request;
		if (context && context.scope === 'public') { // private is the default, all adaptors have to set the scope explicitly
			if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
				return this.createErrorObservable(new Error('unauthorized'));
			}
		}

		const realRequest: any = NaniumObject.create(
			request,
			requestConstructor,
			requestConstructor[genericTypesSymbol]);


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
				(Array.isArray(requestType.skipInterceptors) && !requestType.skipInterceptors.includes(interceptor.constructor.name)) ||
				((requestType.skipInterceptors ?? {})[context.scope] === true) ||
				((Array.isArray(requestType.skipInterceptors ?? {})[context.scope]) && !requestType.skipInterceptors[context.scope].includes(interceptor.constructor.name))
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
		for (const channel of this.config.channels ?? []) { // channels
			if (!channel.eventSubscriptions) {
				continue;
			}
			Nanium.logger.info('provider nodejs emit: event ', eventName, channel.eventSubscriptions[eventName]?.length ?? 0);
			Nanium.logger.info('provider nodejs emit: active subscriptions. ', channel.eventSubscriptions[eventName]?.length ?? 0);
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
				for (const s of this.internalEventSubscriptions[eventName]) {
					s.handler(event);
				}
			}
		}
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	async subscribe(eventConstructor: new() => any, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		const eventName: string = (eventConstructor as any).eventName;
		const subscription = new EventSubscription('', eventName, handler);
		this.internalEventSubscriptions[eventName] = this.internalEventSubscriptions[eventName] ?? [];
		this.internalEventSubscriptions[eventName].push(subscription);
		return subscription;
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		eventName = subscription?.eventName ?? eventName;
		if (subscription) {
			if (eventName in this.internalEventSubscriptions) {
				this.internalEventSubscriptions[eventName] = this.internalEventSubscriptions[eventName]
					.filter(s => s !== subscription);
			}
		} else {
			delete this.internalEventSubscriptions[eventName];
		}
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		if (this.config.eventSubscriptionReceiveInterceptors?.length) {
			let interceptor: EventSubscriptionReceiveInterceptor<any>;
			for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
				interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
				await interceptor.execute(subscriptionData);
			}
		}
	}
}
