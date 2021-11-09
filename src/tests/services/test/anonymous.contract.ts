import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NocatSelf.Anonymous';
	static scope: ServiceExecutionScope = 'public';
	static skipInterceptors: any[] = ['test'];
	static responseCoreConstructor: any = String;
}
