import { Observable } from 'rxjs';
import { ExecutionContext } from './executionContext';
import { KindOfResponsibility } from './kindOfResponsibility';
import { EventHandler } from './eventHandler';
import { EventSubscription } from './eventSubscriptionInterceptor';

export interface ServiceManager {

	/**
	 * initialize the manager.
	 * Nocat will call this when the manager (provider or consumer) is added to the nocat service managers via Nocat.addManager
	 */
	init(): Promise<void>;

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
	 * must return 'yes' if this manager is responsible for the given request or all requests with the given name
	 * @param request
	 * @param serviceName
	 */
	isResponsible(request: any, serviceName: string): Promise<KindOfResponsibility>;

	/**
	 * initialize the manager.
	 * Nanium will call this when the manager (provider or consumer) is added to the nanium service managers via Nanium.addManager
	 * must return 'yes' if this manager is responsible for events with the given name
	 * @param eventName
	 */
	isResponsibleForEvent(eventName: string): Promise<KindOfResponsibility>;

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
	subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<void>;

	/**
	 * unsubscribe from a specific eventType
	 * @param eventConstructor
	 * @param handler
	 */
	unsubscribe(eventConstructor: any, handler?: (data: any) => Promise<void>): Promise<void>;

	/**
	 * receive a subscription: decide to accept or to reject the subscription
	 * if accepted just return
	 * if not accepted throw an error
	 * @param subscriptionData
	 */
	receiveSubscription(subscriptionData: EventSubscription): Promise<void>;
}
