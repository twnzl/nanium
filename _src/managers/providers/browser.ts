import { Observable, Observer } from 'rxjs';
import { ServiceExecutor } from '../../interfaces/serviceExecutor';
import { ExecutionContext } from '../../interfaces/executionContext';
import { NaniumRepository } from '../../interfaces/serviceRepository';
import { ServiceProviderManager } from '../../interfaces/serviceProviderManager';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ServiceRequestInterceptor } from '../../interfaces/serviceRequestInterceptor';

export class NaniumBrowserProviderConfig {
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
	 * interceptors (code that runs before each request is executed)
	 */
	requestInterceptors?: (ServiceRequestInterceptor<any> | (new() => ServiceRequestInterceptor<any>))[];
}


export class NaniumProviderBrowser implements ServiceProviderManager {
	repository: NaniumRepository;
	internalEventSubscriptions: { [eventName: string]: ((event: any) => void)[] } = {};
	config: NaniumBrowserProviderConfig = {
		isResponsible: async (): Promise<number> => Promise.resolve(1),
		isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
		handleError: async (err: any): Promise<any> => {
			throw err;
		}
	};

	// private eventSubscriptions: { [clientId: string]: ProviderEventSubscriptionInfo } = {};

	constructor(config: NaniumBrowserProviderConfig) {
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
	}

	async terminate(): Promise<void> {
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute(serviceName: string, request: any, context?: ExecutionContext): Promise<any> {
		context = context || {};

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

			// interceptors
			if (this.config.requestInterceptors?.length) {
				let result: any;
				for (const interceptor of this.config.requestInterceptors) {
					result = await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, context);
					// if an interceptor returns an object other than the request it is a result and the execution shall be
					// finished with this result
					if (result !== undefined && result !== request) {
						return result;
					}
				}
			}

			// execution
			const executor: ServiceExecutor<any, any> = new this.repository[serviceName].Executor();
			return await executor.execute(request, context);
		} catch (e) {
			return await this.config.handleError(e, serviceName, request, context);
		}
	}

	stream(serviceName: string, request: any, context?: ExecutionContext): Observable<any> {// validation
		context = context || {};

		if (this.repository === undefined) {
			return this.createErrorObservable(new Error('nanium service repository is not initialized'));
		}
		if (!Object.prototype.hasOwnProperty.call(this.repository, serviceName)) {
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
			new this.repository[serviceName].Executor().stream(realRequest, context).subscribe({
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
	}

	private createErrorObservable(e: any): Observable<any> {
		return new Observable((observer: Observer<any>): void => {
			observer.error(e);
		});
	}

	async emit(eventName: string, event: any, executionContext: ExecutionContext): Promise<void> {
		if (this.internalEventSubscriptions[eventName]?.length) {
			for (const handler of this.internalEventSubscriptions[eventName]) {
				handler(event);
			}
		}
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	async subscribe(eventConstructor: new() => any, handler: EventHandler): Promise<EventSubscription> {
		const eventName: string = (eventConstructor as any).eventName;
		this.internalEventSubscriptions[eventName] =
			this.internalEventSubscriptions[eventName] ?? [];
		this.internalEventSubscriptions[eventName].push(handler);
		return new EventSubscription('', eventName, handler);
	}

	async unsubscribe(eventConstructor: any, handler?: (data: any) => Promise<void>): Promise<void> {
		const eventName: string = eventConstructor.eventName;
		if (handler) {
			this.internalEventSubscriptions[eventName] = this.internalEventSubscriptions[eventName].filter(h => h !== handler);
		} else {
			delete this.internalEventSubscriptions[eventName];
		}
	}

	async receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
	}
}
