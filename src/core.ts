import { Observable } from 'rxjs';
import { ServiceManager } from './interfaces/serviceManager';
import { ServiceExecutionContext } from './interfaces/serviceExecutionContext';
import { LogMode } from './interfaces/logMode';
import { ServiceRequestQueue } from './interfaces/serviceRequestQueue';
import { ServiceRequestQueueEntry } from './interfaces/serviceRequestQueueEntry';
import { DateHelper } from './helper';

export class Nocat {
	static #isShutDownInitiated: boolean;

	static managers: ServiceManager[];
	static queues: ServiceRequestQueue[];
	static logMode: LogMode;

	static get isShutDownInitiated(): boolean {
		return this.#isShutDownInitiated;
	}

	static async init(managers: ServiceManager[], queues?: ServiceRequestQueue[], logMode?: LogMode): Promise<void> {
		this.managers = managers;
		this.queues = queues ?? [];
		this.logMode = logMode || LogMode.error;
		const promises: Promise<any>[] = [];
		for (const manager of this.managers) {
			promises.push(manager.init());
		}
		for (const queue of this.queues) {
			promises.push(Nocat.initQueue(queue));
		}
		await Promise.all(promises);
	}

	static isStream(serviceName: string): boolean {
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		return manager.isStream(serviceName);
	}

	static async execute(request: any, serviceName?: string, context?: ServiceExecutionContext): Promise<any> {
		serviceName = serviceName || request.constructor.serviceName;
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		if (!manager) {
			throw new Error('nocat has not been initialized');
		}
		// todo: determine which manager is responsible for this request
		return await manager.execute(serviceName, request, context);
	}

	static stream(request: any, serviceName?: string, context?: ServiceExecutionContext): Observable<any> {
		serviceName = serviceName || request.constructor.serviceName;
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		if (!manager) {
			throw new Error('nocat has not been initialized');
		}
		return manager.stream(serviceName, request, context);
	}

	static async enqueue<TRequest>(
		entry: ServiceRequestQueueEntry
	): Promise<ServiceRequestQueueEntry> {
		const queue: ServiceRequestQueue = this.getResponsibleQueue(entry.serviceName);
		if (!queue) {
			throw new Error('nocat: no queue has been initialized');
		}
		delete entry.response;
		delete entry.id;
		entry.state = 'ready';

		const result: ServiceRequestQueueEntry = await queue.enqueue(entry);
		Nocat.executeTimeControlled(result, queue);
		return result;
	}

	static getResponsibleManager(serviceName: string): ServiceManager {
		const result: ServiceManager = this.managers.find((manager: ServiceManager) => manager.isResponsible(serviceName) === 'yes');
		if (result) {
			return result;
		}
		return this.managers.find((manager: ServiceManager) => manager.isResponsible(serviceName) === 'fallback');
	}

	static getResponsibleQueue(serviceName: string): ServiceRequestQueue {
		const result: ServiceRequestQueue = this.queues.find((queue: ServiceRequestQueue) => queue.isResponsible(serviceName) === 'yes');
		if (result) {
			return result;
		}
		return this.queues.find((queue: ServiceRequestQueue) => queue.isResponsible(serviceName) === 'fallback');
	}

	//#region queue
	static async onReadyQueueEntry(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<void> {
		try {
			await Nocat.executeTimeControlled(entry, requestQueue);
		} catch (e) {
			console.error(e.stack ? e.stack.toString() : e.toString);
			// Nocat.emit(NocatEvents.exception, e);
		}
	}

	// execute an request considering the settings of startDate, interval, etc.
	private static executeTimeControlled(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): void {

		const start: () => Promise<void> = async (): Promise<void> => {
			try {
				entry.startDate = entry.startDate || new Date();
				await requestQueue.updateEntry(entry);
				entry.response = await Nocat.execute(
					entry.request,
					entry.serviceName,
					requestQueue.config.getExecutionContext(entry.serviceName, entry.request));
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
					console.log(JSON.stringify(error));
					console.log(JSON.stringify(e));
				}
			}
		};

		const tryStart: () => Promise<boolean> = async (): Promise<boolean> => {
			if (entry.endOfInterval && new Date() >= entry.endOfInterval) {
				entry.endDate = new Date();
				entry.state = 'canceled';
				await requestQueue.updateEntry(entry);
				return;
			}
			entry = await requestQueue.tryTake(entry);
			if (!entry) {
				return;
			}
			let lastRun: Date;
			try {
				lastRun = new Date();
				await start();
			} catch (e) {
				console.log(e);
			} finally {
				entry = await requestQueue.refreshEntry(entry);
				let nextRun: Date = DateHelper.addSeconds(entry.interval, lastRun);
				if (entry.interval) {
					if (nextRun < new Date()) {
						nextRun = new Date();
					}
					if (!entry.endOfInterval || nextRun < new Date(entry.endOfInterval)) {
						const nextEntry: ServiceRequestQueueEntry = { ...entry };
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
		};

		// logic
		if (!this.isShutDownInitiated && !requestQueue.isShutdownInitiated) {
			if (!entry.startDate || new Date(entry.startDate) < new Date()) {
				tryStart().then();
			}
		}
	}

	static async shutdown(): Promise<void> {
		if (this.queues?.length) {
			await Promise.all(
				this.queues.map((q: ServiceRequestQueue) => {
					q.isShutdownInitiated = true;
					return q.stop();
				})
			);
		}
	}

	private static async initQueue(requestQueue: ServiceRequestQueue): Promise<void> {

		// load all current entries that have not been started so far and start them as configured
		const readyEntries: ServiceRequestQueueEntry[] = await requestQueue
			.getEntries({ states: ['ready'] });
		for (const entry of readyEntries) {
			await Nocat.executeTimeControlled(entry, requestQueue);
		}
	}
}
