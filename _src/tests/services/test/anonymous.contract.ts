import { ServiceRequestBase } from '../serviceRequestBase';
import { TestServerRequestInterceptor } from '../../interceptors/server/test.request.interceptor';
import { RequestType } from '../../../objects';

// disabled to test services without this decorator
@RequestType({
	responseType: String,
	skipInterceptors: ['TestServerRequestInterceptor'],
	scope: 'public'
})
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';
}
