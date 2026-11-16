import { ServiceRequestBase } from '../serviceRequestBase.js';
import { ServiceResponseBase } from '../serviceResponseBase.js';
import { TestServerRequestInterceptor } from '../../interceptors/server/test.request.interceptor.js';
import { RequestType } from '../../../objects.js';

// disabled to test services without this decorator
@RequestType({
	responseType: ServiceResponseBase,
	skipInterceptors: ['TestServerRequestInterceptor'],
	scope: 'public'
})
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';
}
