import { ExecutionContext } from './executionContext';
import { NaniumSerializer } from './serializer';

export interface ChannelConfig {
	executionContextConstructor?: new(data: ExecutionContext) => ExecutionContext;
	serializer?: NaniumSerializer;
}
