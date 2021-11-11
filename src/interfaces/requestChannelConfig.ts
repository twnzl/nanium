import { ServiceExecutionContext } from './serviceExecutionContext';
import { NaniumSerializer } from './serializer';

export interface RequestChannelConfig {
	executionContextConstructor?: new(data: ServiceExecutionContext) => ServiceExecutionContext;
	serializer?: NaniumSerializer;
}
