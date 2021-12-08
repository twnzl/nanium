import { ExecutionContext } from '../../interfaces/executionContext';
import { ExecutionScope } from '../../interfaces/executionScope';

export class ServiceRequestContext implements ExecutionContext {
	scope?: ExecutionScope;
	user: any;

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}
}
