import {ServiceRequestBase} from '..';

export default interface ServiceRequestInterceptor {
	execute(request: ServiceRequestBase<any, any>, scope?: string): Promise<ServiceRequestBase<any, any>>;
}
