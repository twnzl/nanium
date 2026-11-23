import { ServiceManager } from './serviceManager.js';
import { ServiceExecutor } from './serviceExecutor.js';
import { Channel } from './channel.js';
import { Message } from './communicator.js';
import { ConstructorType } from '../objects.js';
export interface ServiceProviderManager extends ServiceManager {
    addService<T>(requestClass: new () => T, executorClass: new () => ServiceExecutor<T, any>): void;
    addChannel<T>(channel: Channel): void;
    getRequestClass(serviceName: string): ConstructorType;
    receiveCommunicatorMessage?(msg: Message): void;
}
