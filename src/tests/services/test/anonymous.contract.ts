import { ServiceRequestBase } from '../serviceRequestBase';

// disabled to test services without this decorator
// @RequestType({
// 	responseType: ServiceResponseBase,
// })
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumSelf.Anonymous';
	static scope: string = 'public';
	static skipInterceptors: string[] = ['test'];
}
