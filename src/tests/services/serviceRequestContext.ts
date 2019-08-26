import { ServiceExecutionContext, ServiceExecutionScope } from '../..';

export class ServiceRequestContext implements ServiceExecutionContext {
	user: any;
	scope: ServiceExecutionScope
}
