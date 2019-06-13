import { ServiceResponseInterceptor } from '../../../../interfaces/serviceResponseInterceptor';
import { ServiceResponseBase } from '../../serviceResponseBase';

export class TestServerResponseInterceptor implements ServiceResponseInterceptor<ServiceResponseBase<any>> {
	async execute(response: ServiceResponseBase<any>): Promise<ServiceResponseBase<any>> {
		response.head = {};
		response.head['tmp'] = ':-)';
		return response;
	}
}
