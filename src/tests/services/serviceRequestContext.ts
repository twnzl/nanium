import { ServiceExecutionContext } from '../../interfaces/serviceExecutionContext';
import { ServiceExecutionScope } from '../../interfaces/serviceExecutionScope';

export class ServiceRequestContext implements ServiceExecutionContext {
	scope?: ServiceExecutionScope;
	user: any;

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}
}
