import { NaniumRepository } from './serviceRepository';
import { EventSubscription } from './eventSubscription';
import { ServiceProviderManager } from './serviceProviderManager';
import { Message } from './communicator';

export interface Channel {
	id: string | number;

	init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void>;

	emitEvent(event: any, subscription: EventSubscription): Promise<void>;

	receiveCommunicatorMessage?(msg: Message): void;

	onClientRemoved: ((clientId) => void)[];

	terminate?(): Promise<void>;
}
