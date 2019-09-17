import { ServiceExecutionContext } from './serviceExecutionContext';

export interface RequestChannelConfig {
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
}
