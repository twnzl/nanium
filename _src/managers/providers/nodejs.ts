import { Stats } from 'fs';
import * as path from 'path';
import * as findFiles from 'recursive-readdir';
import { Channel } from '../../interfaces/channel';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';
import { Nanium } from '../../core';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
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
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { Message } from '../../interfaces/communicator';

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
	eventSubscriptions: { [eventName: string]: EventSubscription[] } = {};
	config: NaniumNodejsProviderConfig = {
		servicePath: 'services',
		requestInterceptors: [],
		isResponsible: async (): Promise<number> => Promise.resolve(1),
		isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
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

	addChannel<T>(channel: Channel): void {
		channel.init(this.repository, this).then();
		channel.onClientRemoved.push(clientId => this.removeClient(clientId));
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
				channel.onClientRemoved.push(clientId => this.removeClient(clientId));
			}
		}
	}

	async terminate(): Promise<void> {
		for (const channel of this.config.channels ?? []) {
			if (typeof channel.terminate === 'function') {
				await channel.terminate();
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
		for (const subscription of this.eventSubscriptions[eventName] ?? []) { // subscriptions
			emissionOk = true;
			for (const interceptor of interceptors) { // interceptors
				emissionOk = await interceptor.execute(event, executionContext, subscription);
				if (!emissionOk) {
					break;
				}
			}
			if (emissionOk) {
				if (subscription.handler) { // subscription on server internally
					subscription.handler(event);
				} else { // subscription of remote client - send through channel
					this.config.channels.find(c => c.id === subscription.channelId)
						?.emitEvent(event, subscription).then();
				}
			}
		}
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	async subscribe(eventConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		const eventName: string = typeof eventConstructor === 'string' ? eventConstructor : eventConstructor.eventName;
		const subscription = new EventSubscription('', eventName, handler);
		this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName] ?? [];
		this.eventSubscriptions[eventName].push(subscription);
		return subscription;
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		eventName = subscription?.eventName ?? eventName;
		if (this.config.eventSubscriptionReceiveInterceptors?.length) {
			let interceptor: EventSubscriptionReceiveInterceptor<any>;
			for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
				interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
				await interceptor.execute(subscription);
			}
		}
		if (subscription) {
			if (eventName in this.eventSubscriptions) {
				this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName]
					.filter(s => s.id !== subscription.id);
				if (!this.eventSubscriptions[eventName].length) {
					delete this.eventSubscriptions[eventName];
				}
			}
		} else {
			delete this.eventSubscriptions[eventName];
		}
	}

	async receiveSubscription(subscription: EventSubscription): Promise<void> {
		if (this.config.eventSubscriptionReceiveInterceptors?.length) {
			let interceptor: EventSubscriptionReceiveInterceptor<any>;
			for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
				interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
				await interceptor.execute(subscription);
			}
		}

		this.eventSubscriptions[subscription.eventName] = this.eventSubscriptions[subscription.eventName] ?? [];
		this.eventSubscriptions[subscription.eventName].push(subscription);
	}

	receiveCommunicatorMessage(msg: Message): void {
		this.config.channels.forEach(c => {
			if (c.receiveCommunicatorMessage) {
				c.receiveCommunicatorMessage(msg);
			}
		});
	}

	async removeClient(clientId: string): Promise<void> {
		for (const eventName of Object.keys(this.eventSubscriptions)) {
			this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName]
				.filter(s => s.clientId !== clientId);
		}
	}
}
