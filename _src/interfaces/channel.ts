import { NaniumRepository } from './serviceRepository';
import { EventSubscription } from './eventSubscription';
import { ServiceProviderManager } from './serviceProviderManager';

export interface Channel {
	init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void>;

	emitEvent(event: any, subscription: EventSubscription): Promise<void>;

	receiveCommunicatorMessage?(msg: any): void;

	onClientRemoved: ((clientId) => void)[];

	terminate?(): Promise<void>;
}
