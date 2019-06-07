import ServiceResponseInterceptor from '../../../../interfaces/serviceResponseInterceptor';
import {ServiceResponseBase} from '../../../../bases/response.base';

export default class TestServerResponseInterceptor implements ServiceResponseInterceptor {

	async execute<TResponseBody>(response: ServiceResponseBase<TResponseBody>, scope?: string): Promise<ServiceResponseBase<TResponseBody>> {
		// e.g. check some stuff like authorization and return an error if not authorized
		response.head = {
			apiLocation: 'localhost/api'
		};
		return response;
	}
}
