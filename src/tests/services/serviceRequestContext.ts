import { ServiceExecutionScope } from '../../interfaces/serviceExecutionScope';
import { ServiceExecutionContext } from '../../interfaces/serviceExecutionContext';

export class ServiceRequestContext implements ServiceExecutionContext {
	user: any;
	scope: ServiceExecutionScope
}
