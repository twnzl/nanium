import { NaniumRepository } from './serviceRepository';
import { EventSubscription } from './eventSubscription';
import { ServiceProviderManager } from './serviceProviderManager';

export interface Channel {
	// manager: ServiceProviderManager;

	// eventSubscriptions: { [eventName: string]: EventSubscription[] };

	init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void>;

	emitEvent(event: any, subscription: EventSubscription): Promise<void>;
}
