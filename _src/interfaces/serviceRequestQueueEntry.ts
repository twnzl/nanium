import { ServiceRequestQueueEntryState } from './serviceRequestQueueEntryState';
import { NaniumObject, Type } from '../objects';

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
	 * alternative for interval - it is possible to configure a recurring execution by a cron-like syntax
	 */
	recurring?: CronConfig;

	/**
	 * date after which no further request shall be executed, in case interval or recurring is set
	 */
	endOfInterval?: Date;

	// /**
	//  * space for individual data e.g. to use it in the isResponsible Function or whatever
	//  */
	// params?: TParams;
}

/**
 * each property can be a number, comma-separated numbers or a '*'
 * e.g.S
 * 	month: '1,4': each January an April
 * 	dayOfWeek: '1': each Monday
 * 	year: '*': each year
 * 	hour: '10': always at hour 10
 * 	minute: '5': always at minute 5
 * 	second: '0': always on second 0
 *
 * 	all this together means: each year on each Monday in January and April at 10:05:00
 *
 * 	skipping any property is the same as setting it to '*'
 */
export class CronConfig extends NaniumObject<CronConfig> {
	@Type(String) second?: string;
	@Type(String) minute?: string;
	@Type(String) hour?: string;
	@Type(String) dayOfMonth?: string;
	@Type(String) month?: string;
	@Type(String) dayOfWeek?: string;
	@Type(String) year?: string;
}

export interface ServiceRequestQueueEntryQueryConditions {
	states?: ServiceRequestQueueEntryState[];
	finishedBefore?: Date;
	startDateReached?: boolean;
}
