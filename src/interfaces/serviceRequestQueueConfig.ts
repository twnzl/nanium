import { KindOfResponsibility } from './kindOfResponsibility';
import { ServiceExecutionContext } from './serviceExecutionContext';
import { ServiceRequest } from './serviceRequest';
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
	getExecutionContext: (requestName: string, request: ServiceRequest<any>) => ServiceExecutionContext;

	/**
	 * must return 'yes', if this queue is responsible for requests with the given name
	 * or 'fallback', if it is only responsible if no other queue is responsible
	 */
	isResponsible?: (entry: ServiceRequestQueueEntry) => KindOfResponsibility;
}
