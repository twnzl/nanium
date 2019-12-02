import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../..';
import { TestServerRequestInterceptor } from '../../interceptors/server/test.request.interceptor';

export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'Anonymous';
	static scope: ServiceExecutionScope = ServiceExecutionScope.public;
	static skipInterceptors: any[] = [TestServerRequestInterceptor];
}
