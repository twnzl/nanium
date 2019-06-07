import ServiceRequestInterceptor from '../../../../interfaces/serviceRequestInterceptor';
import {ServiceRequestBase} from '../../../../bases/request.base';

export default class TestServerRequestInterceptor implements ServiceRequestInterceptor {

	async execute<TResponseBody>(
		request: ServiceRequestBase<any, TResponseBody>, scope?: string
	): Promise<ServiceRequestBase<any, TResponseBody>> {
		request.head = {
			apiVersion: '45'
		};
		return request;
	}
}
