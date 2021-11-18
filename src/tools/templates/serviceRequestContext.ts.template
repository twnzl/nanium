import { ServiceExecutionContext } from 'nanium/interfaces/serviceExecutionContext';
import { ServiceExecutionScope } from 'nanium/interfaces/serviceExecutionScope';

export class ServiceRequestContext implements ServiceExecutionContext {
	scope?: ServiceExecutionScope;
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
