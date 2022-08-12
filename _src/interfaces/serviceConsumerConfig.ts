import { ServiceRequestInterceptor } from './serviceRequestInterceptor';
import { NaniumSerializer } from './serializer';
import { EventSubscriptionSendInterceptor } from './eventSubscriptionInterceptor';

export interface ServiceConsumerConfig {
	/**
	 * request receive interceptors
	 * code that runs before a request will be sent to the provider
	 * (e.g. to add authorization information)
	 */
	requestInterceptors?: (ServiceRequestInterceptor<any> | (new() => ServiceRequestInterceptor<any>))[];

	/**
	 * event Submission interceptors
	 * code that runs before an event subscription will be sent to the provider
	 * (e.g. to add authorization information)
	 */
	eventSubscriptionSendInterceptors?: (EventSubscriptionSendInterceptor<any, any> | (new() => EventSubscriptionSendInterceptor<any, any>))[];

	/**
	 * if the provider finished the request execution with an error, this function will be called on consumer side
	 * to give the opportunity to handle the error at a general place. if not handled (thrown again) the initiator of the
	 * request has to care specifically
	 * e.g.
	 * @param e
	 */
	handleError?: (e: any) => Promise<void>;

	/**
	 * returns if the Manager is responsible for the given Service
	 * 0 means not responsible and >0 means responsible, with the rule that the one with the highest number wins
	 */
	isResponsible?: (request: any, serviceName: string) => Promise<number>;

	/**
	 * returns if the Manager is responsible for the given eventName
	 * manager with the highest values above 0 wins
	 * @param eventName
	 * @param context
	 */
	isResponsibleForEvent?: (eventName: string, context?: any) => Promise<number>;

	/**
	 * the serializer that shall be used to serialize data before they are sent to the provider,
	 * and deserialize data that came from the provider
	 * @param eventName
	 */
	serializer?: NaniumSerializer;
}
