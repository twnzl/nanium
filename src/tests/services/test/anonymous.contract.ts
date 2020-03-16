import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../..';

export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NocatSelf.Anonymous';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
	static skipInterceptors: any[] = ['test'];
}
