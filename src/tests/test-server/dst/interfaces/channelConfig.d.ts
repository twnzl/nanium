import { ExecutionContext } from './executionContext.js';
import { NaniumSerializer } from './serializer.js';
export interface ChannelConfig {
    executionContextConstructor?: new (data: ExecutionContext) => ExecutionContext;
    serializer: NaniumSerializer;
}
