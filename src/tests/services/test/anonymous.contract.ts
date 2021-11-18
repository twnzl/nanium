import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../serializers/core';
import { ServiceResponseBase } from '../serviceResponseBase';

// disabled to test services without this decorator
@RequestType({
	responseType: ServiceResponseBase,
	skipInterceptors: ['test']
})
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';
	static scope: string = 'public';
	static skipInterceptors: string[] = ['test'];
}
