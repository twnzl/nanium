import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NocatSelf.Anonymous';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
	static skipInterceptors: any[] = ['test'];
}
