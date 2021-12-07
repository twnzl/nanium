import { ServiceExecutionContext } from './serviceExecutionContext';
import { NaniumSerializer } from './serializer';

export interface ChannelConfig {
	executionContextConstructor?: new(data: ServiceExecutionContext) => ServiceExecutionContext;
	serializer?: NaniumSerializer;
}
