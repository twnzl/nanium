import { KindOfResponsibility } from './kindOfResponsibility';
import { ServiceRequestQueueEntry, ServiceRequestQueueEntryQueryConditions } from './serviceRequestQueueEntry';
import { ServiceExecutionContext } from './serviceExecutionContext';

/**
 * a request queue that can be used by bocl has to implement these members
 */
export interface ServiceRequestQueue {
	/**
	 * if true, no new requests will be started
	 */
	isShutdownInitiated: boolean;

	/**
	 * initialize th queue. Nanium will call this when the queue is added to the nanium queues via Nanium.addQueue
	 */
	init(): Promise<void>;

	/**
	 * must return 'yes' if this queue is responsible for requests with the given name
	 * @param entry
	 */
	isResponsible(entry: ServiceRequestQueueEntry): Promise<KindOfResponsibility>;

	/**
	 * enqueue a new entry into the queue
	 * @param entry
	 * @param executionContext the context for the execution of the request
	 */
	enqueue(entry: ServiceRequestQueueEntry, executionContext?: ServiceExecutionContext): Promise<ServiceRequestQueueEntry>;

	/**
	 * Will run, after an entry is set to running but before it ist started.
	 * So for example this could set some values in the params property of the entry
	 * @param entry
	 * @returns the changed entry
	 */
	onBeforeStart(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

	/**
	 * take an entry and mark it as running, in one step, so that no other process can take it simultaneously
	 * @param entry the entry
	 * @returns true if it was successful, false if vor example someone else has already taken the entry
	 */
	tryTake(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

	/**
	 * create an execution context for a specific entry. It will be used for the execution of the request
	 * @param entry
	 */
	getExecutionContext(entry: ServiceRequestQueueEntry): Promise<ServiceExecutionContext>;

	/**
	 * update an entry
	 * @param entry the entry
	 */
	updateEntry(entry: ServiceRequestQueueEntry): Promise<void>;

	/**
	 * refresh an entry
	 * maybe during execution something has changed (e.g. the entry was canceled)
	 * @param entry the entry
	 */
	refreshEntry(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

	/**
	 * creates an specific internal entry object for a specific queue implementation and copies the properties.
	 * It will not be enqueued by this function, just constructed!
	 * @param src
	 */
	copyEntry(src: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

	/**
	 * get all entries or all of the specified conditions
	 */
	getEntries(conditions: ServiceRequestQueueEntryQueryConditions): Promise<ServiceRequestQueueEntry[]>;

	/**
	 * remove all entries or all of the specified conditions
	 */
	removeEntries(conditions: ServiceRequestQueueEntryQueryConditions): Promise<void>;

	/**
	 * start no further requests and wait until all started requests are finished
	 */
	stop(): Promise<void>;

}
