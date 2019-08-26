import { ServiceExecutionContext } from './serviceExecutionContext';

export interface TransportAdaptorConfig {
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
}
