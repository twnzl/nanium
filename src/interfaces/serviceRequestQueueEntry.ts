import { ServiceRequestQueueEntryState } from './serviceRequestQueueEntryState';

/**
 * this is how a service request queue entry must look like
 */
export interface ServiceRequestQueueEntry {
	/**
	 * id of the request queue entry
	 */
	id?: string;

	/**
	 * full qualified name of the Service (underscores are used to separate namespace parts)
	 */
	serviceName: string;

	/**
	 * an id or name to mark many concrete request entries as of the same group or kind
	 */
	groupId?: string;

	/**
	 * the request
	 */
	request: any;

	/**
	 * the response - is set after finishing execution
	 */
	response?: any;

	/**
	 * state of the entry
	 */
	state?: ServiceRequestQueueEntryState;

	/**
	 * date on which the execution shall start
	 */
	startDate?: Date;

	/**
	 * date on which the execution has finished
	 */
	endDate?: Date;

	/**
	 * seconds after that the request shall be executed again - measured from the start of the last execution
	 * for each execution a new request will be inserted, so the history including the result of each execution is available
	 */
	interval?: number;

	/**
	 * date after which no further request shall be executed
	 */
	endOfInterval?: Date;
}

export interface ServiceRequestQueueEntryQueryConditions {
	states?: ServiceRequestQueueEntryState[];
	finishedBefore?: Date;
}
