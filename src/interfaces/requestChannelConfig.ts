import { ServiceExecutionContext } from './serviceExecutionContext';
import { NocatSerializer } from './serializer';

export interface RequestChannelConfig {
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
	serializer?: NocatSerializer;
}
