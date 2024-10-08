import { ServiceRequestQueueEntry, ServiceRequestQueueEntryQueryConditions } from './serviceRequestQueueEntry';
import { ExecutionContext } from './executionContext';

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
	 * must return 0 if this queue is not responsible for requests with the given name or a value above 0 as the rank if
	 * multiple queues are defined (the highest wins)
	 * @param entry
	 */
	isResponsible(entry: ServiceRequestQueueEntry): Promise<number>;

	/**
	 * enqueue a new entry into the queue
	 * @param entry
	 * @param executionContext the context for the execution of the request
	 */
	enqueue(entry: ServiceRequestQueueEntry, executionContext?: ExecutionContext): Promise<ServiceRequestQueueEntry>;

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
	getExecutionContext(entry: ServiceRequestQueueEntry, requestQueue: ServiceRequestQueue): Promise<ExecutionContext>;

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
