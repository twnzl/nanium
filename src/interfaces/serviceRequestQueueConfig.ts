import { KindOfResponsibility } from './kindOfResponsibility';
import { ServiceExecutionContext } from './serviceExecutionContext';
import { ServiceRequestQueueEntry } from './serviceRequestQueueEntry';

export class ServiceRequestQueueConfig {

	/**
	 * connection url for the mongodb server
	 */
	serverUrl: string;

	/**
	 * name of the database where the request collection is in.
	 */
	databaseName: string;

	/**
	 * name of the collection where the requests shall be stored
	 */
	collectionName: string = 'requestQueue';

	/**
	 * function to build the execution context for each queued request,
	 * that shall be used for the execution
	 */
	getExecutionContext: (requestName: string, request: any) => Promise<ServiceExecutionContext>;

	/**
	 * must return 'yes', if this queue is responsible for requests with the given name
	 * or 'fallback', if it is only responsible if no other queue is responsible
	 */
	isResponsible?: (entry: ServiceRequestQueueEntry) => Promise<KindOfResponsibility>;

	/**
	 * Will run, after an entry is set to running but before it ist started.
	 * So for example this could set some values in the params property of the entry
	 * @param entry
	 * @returns the changed entry
	 */
	onBeforeStart?(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry>;
}
