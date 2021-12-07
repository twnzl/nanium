import { NaniumRepository } from './serviceRepository';
import { ServiceExecutionContext } from './serviceExecutionContext';

export interface Channel {
	init(serviceRepository: NaniumRepository): Promise<void>;

	emitEvent(event: any, context: ServiceExecutionContext): Promise<void>;
}
