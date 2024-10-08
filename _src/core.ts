// todo: optimize rxjs import. Automatically removing of unnecessary code (Minimizing/TreeShaking) will not work for nanium as a commonJs module
import { Observable, Observer } from 'rxjs';
import { ServiceManager } from './interfaces/serviceManager';
import { ExecutionContext } from './interfaces/executionContext';
import { ServiceRequestQueue } from './interfaces/serviceRequestQueue';
import { ServiceRequestQueueEntry } from './interfaces/serviceRequestQueueEntry';
import { DateHelper } from './helper';
import { EventSubscription } from './interfaces/eventSubscription';
import { Logger, LogLevel } from './interfaces/logger';
import { NaniumCommunicator } from './interfaces/communicator';
import { EventNameOrConstructor } from './interfaces/eventConstructor';

declare var global: any;

export const managerSymbol: symbol = Symbol.for('__nanium__manager__');

class ConsoleLogger implements Logger {
	loglevel: LogLevel = LogLevel.none;
	includeTimestamp: boolean = true;

	constructor(level: LogLevel) {
		this.loglevel = level;
	}

	trySerialize(arg: any): any {
		if (typeof arg === 'object') {
			try {
				return JSON.stringify(arg);
			} catch {
			}
		}
		return arg;
	}

	time(): string {
		return (this.includeTimestamp ? new Date().toISOString() + ': ' : '');
	}

	error(...args: any[]): void {
		if (this.loglevel >= LogLevel.error) {
			console.error(this.time() + 'nanium: ', ...args.map(a => {
				if (a?.message) {
					return a.message + a.stack;
				} else {
					return this.trySerialize(a);
				}
			}));
		}
	}

	warn(...args: any[]): void {
		if (this.loglevel >= LogLevel.warn) {
			console.warn(this.time() + 'nanium: ', ...args.map(a => {
				return this.trySerialize(a);
			}));
		}
	}

	info(...args: any[]): void {
		if (this.loglevel >= LogLevel.info) {
			console.log(this.time() + 'nanium: ', ...args.map(a => {
				return this.trySerialize(a);
			}));
		}
	}
}

export class CNanium {
	private _isShutDownInitiated: boolean;

	managers: ServiceManager[] = [];
	queues: ServiceRequestQueue[] = [];
	logger: Logger = new ConsoleLogger(LogLevel.warn);

	// Supports functions to communicate with other processes or threads of the same server instance or even other hosted
	// server instances of the same nanium scope.
	// for example this is used to spread information about emitted events
	communicators: NaniumCommunicator[] = [];

	get isShutDownInitiated(): boolean {
		return this._isShutDownInitiated;
	}

	async addManager(manager: ServiceManager): Promise<void> {
		this.managers.push(manager);
		await manager.init();
	}

	async removeManager(manager: ServiceManager): Promise<void> {
		this.managers = this.managers.filter(m => m !== manager);
		await manager.terminate();
	}

	async addQueue(queue: ServiceRequestQueue): Promise<void> {
		this.queues.push(queue);
		await queue.init();
		await this.startQueue(queue);
	}

	async removeQueue(fn: (q: ServiceRequestQueue) => boolean): Promise<void> {
		const queues: ServiceRequestQueue[] = this.queues.filter(fn);
		await Promise.all(queues.map(queue => {
			return queue.stop();
		}));
		this.queues = this.queues.filter((q: ServiceRequestQueue) => !fn(q));
	}

	async execute(request: any, serviceName?: string, context?: ExecutionContext): Promise<any> {
		serviceName = serviceName || request.constructor.serviceName;
		const manager: ServiceManager = await this.getResponsibleManager(request, serviceName);
		if (!manager) {
			throw new Error('no responsible manager for Service "' + serviceName + '" found');
		}
		const result = await manager.execute(serviceName, request, context);
		return result;
	}

	stream<TResult = any>(request: any, serviceName?: string, context?: ExecutionContext): Observable<TResult> {
		console.warn('generate stream service is deprecated, please use normal service with response type: Promise<NaniumStream<ObjectType>> for object streaming or Promise<NaniumStream<NaniumBuffer>> for binary streaming');
		serviceName = serviceName || request.constructor.serviceName;
		const managerPromise: Promise<ServiceManager> = this.getResponsibleManager(request, serviceName);
		return new Observable((observer: Observer<any>): void => {
			managerPromise.then(manager => {
				if (!manager) {
					observer.error('no responsible service provider found');
				} else {
					manager.stream(serviceName, request, context).subscribe({
						next: (value) => {
							observer.next(value);
						},
						complete: () => {
							setTimeout(() => observer.complete());
						},
						error: (e: any): void => {
							observer.error(e);
						}
					});
				}
			});
		});
	}

	async enqueue<TRequest>(
		entry: ServiceRequestQueueEntry,
		executionContext?: ExecutionContext
	): Promise<ServiceRequestQueueEntry> {
		const queue: ServiceRequestQueue = await this.getResponsibleQueue(entry);
		if (!queue) {
			throw new Error('nanium: no queue has been initialized');
		}
		delete entry.response;
		delete entry.id;
		entry.state = 'ready';

		const result: ServiceRequestQueueEntry = await queue.enqueue(entry, executionContext);
		this.executeTimeControlled(result, queue);
		return result;
	}

	emit(event: any, eventName?: string, context?: ExecutionContext, broadcast: boolean = true): void {
		eventName = eventName ?? event.constructor.eventName;
		this.managers.forEach((manager: ServiceManager) => manager.emit(eventName, event, context));
		if (broadcast) {
			for (const communicator of this.communicators) {
				communicator.broadcastEvent(event, eventName, context).then();
			}
		}
	}

	async subscribe(
		eventNameOrConstructor: EventNameOrConstructor,
		handler: (data: any) => Promise<void>,
		managerOrData?: ServiceManager | Omit<any, 'subscribe'>
	): Promise<EventSubscription> {
		let manager: ServiceManager;
		let data: any;
		const eventName: string = typeof eventNameOrConstructor === 'string' ? eventNameOrConstructor : eventNameOrConstructor.eventName;
		if (managerOrData && (managerOrData as ServiceManager).subscribe) {
			manager = managerOrData as ServiceManager;
		} else {
			data = managerOrData;
			manager = await this.getResponsibleManagerForEvent(eventName, data);
		}
		if (!manager) {
			throw new Error('no responsible manager for event "' + eventName + '" found');
		}
		const subscription: EventSubscription = await manager.subscribe(eventNameOrConstructor, handler);
		subscription[managerSymbol] = manager;
		return subscription;
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string, broadcast: boolean = true): Promise<void> {
		eventName = eventName ?? subscription?.eventName;
		const manager = subscription ? subscription[managerSymbol] : undefined;
		if (manager) {
			await manager.unsubscribe(subscription, eventName);
		} else {
			for (const manager of this.managers) {
				if (await manager.isResponsibleForEvent(eventName, subscription)) {
					await manager.unsubscribe(subscription, eventName);
				}
			}
		}
		if (broadcast) {
			this.communicators.forEach(c => c.broadcastUnsubscription(subscription));
		}
	}

	async receiveSubscription(subscription: EventSubscription, broadcast: boolean = true): Promise<void> {
		for await (const manager of this.managers) {
			if (await manager.isResponsibleForEvent(subscription.eventName, subscription)) {
				await manager.receiveSubscription(subscription);
			}
		}
		if (broadcast) {
			this.communicators.forEach(c => c.broadcastSubscription(subscription));
		}
	}

	async getResponsibleManager(request: any, serviceName: string): Promise<ServiceManager> {
		if (this.managers.length === 0) {
			throw new Error('nanium: no managers registered - call Nanium.addManager().');
		}
		const priorities: number[] = await Promise.all(
			this.managers.map((manager: ServiceManager) => manager.isResponsible(request, serviceName)));
		const maxPriority = Math.max(...priorities);
		let idx: number = priorities.findIndex(p => p === maxPriority);
		if (idx >= 0 && priorities[idx] > 0) {
			return this.managers[idx];
		}
		return undefined;
	}

	async getResponsibleManagerForEvent(eventName: string, data: any): Promise<ServiceManager> {
		if (this.managers.length === 0) {
			throw new Error('nanium: no managers registered - call Nanium.addManager().');
		}
		const priorities: number[] = await Promise.all(
			this.managers.map((manager: ServiceManager) => manager.isResponsibleForEvent(eventName, data)));
		const maxPriority = Math.max(...priorities);
		let idx: number = priorities.findIndex(p => p === maxPriority);
		if (idx >= 0 && priorities[idx] > 0) {
			return this.managers[idx];
		}
		return undefined;
	}

	//#region queue
	async getResponsibleQueue(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueue> {
		const priorities: number[] = await Promise.all(
			this.queues.map((queue: ServiceRequestQueue) => queue.isResponsible(entry)));
		const maxPriority = Math.max(...priorities);
		let idx: number = priorities.findIndex(p => p === maxPriority);
		if (idx >= 0 && priorities[idx] > 0) {
			return this.queues[idx];
		}
		return undefined;
	}

	async onReadyQueueEntry(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<void> {
		try {
			await this.executeTimeControlled(entry, requestQueue);
		} catch (e) {
			Nanium.logger.error(e.message, e.stack);
		}
	}

	// execute an request considering the settings of startDate, interval, etc.
	private executeTimeControlled(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): void {
		if (!this.isShutDownInitiated && !requestQueue.isShutdownInitiated) {
			if (!entry.startDate || new Date(entry.startDate) < new Date()) {
				this.tryStart(entry, requestQueue).then();
			}
		}
	}

	private async start(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<void> {
		try {
			entry = await requestQueue.onBeforeStart(entry);
			entry.startDate = entry.startDate || new Date();
			await requestQueue.updateEntry(entry);
			entry.response = await this.execute(
				entry.request,
				entry.serviceName,
				await requestQueue.getExecutionContext(entry, requestQueue));
			entry.state = 'done';
			entry.endDate = new Date();
			await requestQueue.updateEntry(entry);
		} catch (error) {
			try {
				entry.response = error.stack ? error.stack?.toString() : JSON.stringify(error, null, 2);
				entry.state = 'failed';
				entry.endDate = new Date();
				await requestQueue.updateEntry(entry);
			} catch (e) {
				await Nanium.logger.error(error);
				await Nanium.logger.error(e);
			}
		}
	}

	private async tryStart(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<boolean> {
		if (entry.endOfInterval && new Date() >= entry.endOfInterval) {
			entry.endDate = new Date();
			entry.state = 'canceled';
			await requestQueue.updateEntry(entry);
			return false;
		}
		entry = await requestQueue.tryTake(entry);
		if (!entry) {
			return false;
		}
		let lastRun: Date;
		try {
			lastRun = new Date();
			await this.start(entry, requestQueue);
		} catch (e) {
			Nanium.logger.error(e);
		} finally {
			entry = await requestQueue.refreshEntry(entry);
			let nextRun: Date = DateHelper.addSeconds(entry.interval, lastRun);
			if (entry.interval) {
				if (nextRun < new Date()) {
					nextRun = new Date();
				}
				if (!entry.endOfInterval || nextRun < new Date(entry.endOfInterval)) {
					const nextEntry: ServiceRequestQueueEntry = await requestQueue.copyEntry(entry);
					delete nextEntry.response;
					delete nextEntry.endDate;
					delete nextEntry.id;
					nextEntry.startDate = nextRun;
					nextEntry.state = 'ready';
					await requestQueue.enqueue(nextEntry); // every execution is a new entry, so you have state and result of each execution
				}
			}
		}
		return true;
	}

	async shutdown(): Promise<void> {
		if (this.queues?.length) {
			await Promise.all(
				this.queues.map((q: ServiceRequestQueue) => {
					q.isShutdownInitiated = true;
					return q.stop();
				})
			);
			this.queues = [];
		}
		if (this.managers?.length) {
			await Promise.all(
				this.managers.map(m => m.terminate())
			);
			this.managers = [];
		}
	}

	private async startQueue(requestQueue: ServiceRequestQueue): Promise<void> {
		// load all current entries that have not been started so far and start them as configured
		const readyEntries: ServiceRequestQueueEntry[] = await requestQueue
			.getEntries({ states: ['ready'], startDateReached: true });
		for (const entry of readyEntries) {
			await this.executeTimeControlled(entry, requestQueue);
		}
	}

	//#endregion queue
}


if (typeof global !== 'undefined') {
	if (!global['__nanium__']) {
		global['__nanium__'] = new CNanium();
	}
} else if (typeof window !== 'undefined') {
	if (!window['__nanium__']) {
		window['__nanium__'] = new CNanium();
	}
} else if (typeof globalThis !== 'undefined') {
	if (!globalThis['__nanium__']) {
		globalThis['__nanium__'] = new CNanium();
	}
}

export const Nanium: CNanium = typeof global !== 'undefined' ? global['__nanium__'] : (
	typeof window !== 'undefined' ? window['__nanium__'] : globalThis['__nanium__']);

