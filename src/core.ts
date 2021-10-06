// todo: optimize rxjs import. Automatically removing of unnecessary code (Minimizing/TreeShaking) will not work for nocat as a commonJs module
import { Observable, Observer } from 'rxjs';
import { ServiceManager } from './interfaces/serviceManager';
import { ServiceExecutionContext } from './interfaces/serviceExecutionContext';
import { LogMode } from './interfaces/logMode';
import { ServiceRequestQueue } from './interfaces/serviceRequestQueue';
import { ServiceRequestQueueEntry } from './interfaces/serviceRequestQueueEntry';
import { DateHelper } from './helper';

export class Nocat {
	static #isShutDownInitiated: boolean;

	static managers: ServiceManager[] = [];
	static queues: ServiceRequestQueue[] = [];
	static logMode: LogMode = LogMode.error;

	static get isShutDownInitiated(): boolean {
		return this.#isShutDownInitiated;
	}

	static async addManager(manager: ServiceManager): Promise<void> {
		this.managers.push(manager);
		await manager.init();
	}

	static async addQueue(queue: ServiceRequestQueue): Promise<void> {
		this.queues.push(queue);
		await queue.init();
		await Nocat.startQueue(queue);
	}

	static async removeQueue(fn: (q: ServiceRequestQueue) => boolean): Promise<void> {
		const queues: ServiceRequestQueue[] = this.queues.filter(fn);
		await Promise.all(queues.map(queue => {
			return queue.stop();
		}));
		this.queues = this.queues.filter((q: ServiceRequestQueue) => !fn(q));
	}

	static async execute(request: any, serviceName?: string, context?: ServiceExecutionContext): Promise<any> {
		serviceName = serviceName || (request.constructor as any).serviceName;
		const manager: ServiceManager = await this.getResponsibleManager(request, serviceName);
		if (!manager) {
			throw new Error('no responsible manager for Service "' + serviceName + '" found');
		}
		// todo: determine which manager is responsible for this request
		return await manager.execute(serviceName, request, context);
	}

	static stream(request: any, serviceName?: string, context?: ServiceExecutionContext): Observable<any> {
		serviceName = serviceName || (request.constructor as any).serviceName;
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
							observer.complete();
						},
						error: (e: any): void => {
							observer.error(e);
						}
					});
				}
			});
		});
	}

	static async enqueue<TRequest>(
		entry: ServiceRequestQueueEntry,
		executionContext?: ServiceExecutionContext
	): Promise<ServiceRequestQueueEntry> {
		const queue: ServiceRequestQueue = await this.getResponsibleQueue(entry);
		if (!queue) {
			throw new Error('nocat: no queue has been initialized');
		}
		delete entry.response;
		delete entry.id;
		entry.state = 'ready';

		const result: ServiceRequestQueueEntry = await queue.enqueue(entry, executionContext);
		Nocat.executeTimeControlled(result, queue);
		return result;
	}

	static async getResponsibleManager(request: any, serviceName: string): Promise<ServiceManager> {
		const result: ServiceManager = this.managers.find(async (manager: ServiceManager) => (await manager.isResponsible(request, serviceName)) === 'yes');
		if (result) {
			return result;
		}
		return this.managers.find(async (manager: ServiceManager) => (await manager.isResponsible(request, serviceName)) === 'fallback');
	}

	static async getResponsibleQueue(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueue> {
		const result: ServiceRequestQueue = this.queues.find(async (queue: ServiceRequestQueue) => (await queue.isResponsible(entry)) === 'yes');
		if (result) {
			return result;
		}
		return this.queues.find(async (queue: ServiceRequestQueue) => (await queue.isResponsible(entry)) === 'fallback');
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
		if (!this.isShutDownInitiated && !requestQueue.isShutdownInitiated) {
			if (!entry.startDate || new Date(entry.startDate) < new Date()) {
				this.tryStart(entry, requestQueue).then();
			}
		}
	}

	private static async start(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<void> {
		try {
			entry = await requestQueue.onBeforeStart(entry);
			entry.startDate = entry.startDate || new Date();
			await requestQueue.updateEntry(entry);
			entry.response = await Nocat.execute(
				entry.request,
				entry.serviceName,
				await requestQueue.getExecutionContext(entry));
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
	}

	private static async tryStart(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<boolean> {
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
			await this.start(entry, requestQueue);
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

	static async shutdown(): Promise<void> {
		if (this.queues?.length) {
			await Promise.all(
				this.queues.map((q: ServiceRequestQueue) => {
					q.isShutdownInitiated = true;
					return q.stop();
				})
			);
			this.queues = [];
			this.managers = [];
		}
	}

	private static async startQueue(requestQueue: ServiceRequestQueue): Promise<void> {
		// load all current entries that have not been started so far and start them as configured
		const readyEntries: ServiceRequestQueueEntry[] = await requestQueue
			.getEntries({ states: ['ready'], startDateReached: true });
		for (const entry of readyEntries) {
			await Nocat.executeTimeControlled(entry, requestQueue);
		}
	}
}
