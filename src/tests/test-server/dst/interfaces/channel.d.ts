import { NaniumRepository } from './serviceRepository.js';
import { EventSubscription } from './eventSubscription.js';
import { ServiceProviderManager } from './serviceProviderManager.js';
import { Message } from './communicator.js';
export interface Channel {
    id: string | number;
    init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void>;
    emitEvent(event: any, subscription: EventSubscription): Promise<void>;
    receiveCommunicatorMessage?(msg: Message): void;
    onClientRemoved: ((clientId: any) => void)[];
    terminate?(): Promise<void>;
}
