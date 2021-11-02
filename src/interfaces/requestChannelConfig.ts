import { ServiceExecutionContext } from './serviceExecutionContext';
import { NocatSerializer } from './serializer';

export interface RequestChannelConfig {
	serializer: NocatSerializer;
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
}
