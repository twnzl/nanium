import { NaniumRepository } from './serviceRepository';
import { EventSubscription } from './eventSubscription';

export interface Channel {
	eventSubscriptions: { [eventName: string]: EventSubscription[] };

	init(serviceRepository: NaniumRepository): Promise<void>;

	emitEvent(event: any, subscription: EventSubscription): Promise<void>;
}
