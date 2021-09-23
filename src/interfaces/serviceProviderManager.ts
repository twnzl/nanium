import { ServiceManager } from './serviceManager';
import { ServiceExecutor } from './serviceExecutor';

export interface ServiceProviderManager extends ServiceManager {
	addService<T>(
		requestClass: new () => T,
		executorClass: new () => ServiceExecutor<T, any>,
	): void;
}
