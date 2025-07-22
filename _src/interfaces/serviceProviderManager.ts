import { ServiceManager } from './serviceManager';
import { ServiceExecutor } from './serviceExecutor';
import { Channel } from './channel';
import { Message } from './communicator';
import { ConstructorType } from '../objects';

export interface ServiceProviderManager extends ServiceManager {
	addService<T>(
		requestClass: new () => T,
		executorClass: new () => ServiceExecutor<T, any>,
	): void;

	addChannel<T>(channel: Channel): void;

	getRequestClass(serviceName: string): ConstructorType;

	receiveCommunicatorMessage?(msg: Message): void;
}
