import { ExecutionContext } from 'nanium/interfaces/executionContext';
import { ExecutionScope } from 'nanium/interfaces/executionScope';

export class ServiceRequestContext implements ExecutionContext {
	scope?: ExecutionScope;
	// todo: add what ever information you need in every request executor.
	// (for example information about the executing client and user)
	// and add logic to an interceptor that sets this information

	constructor(data: Partial<ServiceRequestContext>) {
		Object.assign(this, data);
	}

	asPrivate(): ServiceRequestContext {
		return new ServiceRequestContext({
			...this,
			...{ scope: 'private' }
		});
	}
}
