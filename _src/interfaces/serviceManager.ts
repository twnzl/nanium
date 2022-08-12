import { Observable } from 'rxjs';
import { ExecutionContext } from './executionContext';
import { EventHandler } from './eventHandler';
import { EventSubscription } from './eventSubscription';

export interface ServiceManager {

	/**
	 * initialize the manager.
	 * Nocat will call this when the manager (provider or consumer) is added to the nocat service managers via Nocat.addManager
	 */
	init(): Promise<void>;

	/**
	 * terminate the manager
	 * this will be called, wenn a manager is removed manually by Nanium.removeManager() or when Nanium gets down via Nanium.shutdown()
	 */
	terminate(): Promise<void>;

	/**
	 * execute a request
	 * @param serviceName
	 * @param request
	 * @param context
	 */
	execute?(serviceName: string, request: any, context?: ExecutionContext): Promise<any>;

	/**
	 * execute a request and expect multiple replies with partial results
	 * @param serviceName
	 * @param request
	 * @param context
	 */
	stream?(serviceName: string, request: any, context?: ExecutionContext): Observable<any>;

	/**
	 * returns if the Manager is responsible for the given Service
	 * 0 means not responsible and >0 means responsible, with the rule that the one with the highest number wins
	 */
	isResponsible(request: any, serviceName: string): Promise<number>;

	/**
	 * returns if the Manager is responsible for the given eventName
	 * manager with the highest values above 0 wins
	 * @param eventName
	 * @param context
	 */
	isResponsibleForEvent(eventName: string, context?: any): Promise<number>;

	/**
	 * emit an event
	 * @param eventName
	 * @param event
	 * @param context
	 */
	emit(eventName: string, event: any, context: ExecutionContext): void;

	/**
	 * subscribe to a specific eventType
	 * @param eventConstructor
	 * @param handler
	 */
	subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<EventSubscription>;

	/**
	 * unsubscribe from a specific eventType
	 * @param subscription
	 */
	unsubscribe(subscription: EventSubscription): Promise<void>;

	/**
	 * receive a subscription: decide to accept or to reject the subscription
	 * if accepted just return
	 * if not accepted throw an error
	 * @param subscriptionData
	 */
	receiveSubscription(subscriptionData: EventSubscription): Promise<void>;
}
