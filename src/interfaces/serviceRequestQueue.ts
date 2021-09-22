import { KindOfResponsibility } from './kindOfResponsibility';
import { ServiceRequestQueueEntry, ServiceRequestQueueEntryQueryConditions } from './serviceRequestQueueEntry';
import { ServiceRequestQueueConfig } from './serviceRequestQueueConfig';

/**
 * a request queue that can be used by bocl has to implement these members
 */
export interface ServiceRequestQueue {

	/**
	 * configuration parameters of this Queue
	 */
	config: ServiceRequestQueueConfig;

	/**
	 * if true, no new requests will be started
	 */
	isShutdownInitiated: boolean;

	/**
	 * must return 'yes' if this queue is responsible for requests with the given name
	 * @param serviceName
	 */
	isResponsible(serviceName: string): KindOfResponsibility;

	/**
	 * enqueue a new entry into the queue
	 * @param entry
	 */
	enqueue(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

	/**
	 * take an entry and mark it as running, in one step, so that no other process can take it simultaneously
	 * @param entry the entry
	 * @returns true if it was successful, false if vor example someone else has already taken the entry
	 */
	tryTake(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;

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
