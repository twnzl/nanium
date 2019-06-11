import ServiceResponseInterceptor from '../../../../interfaces/serviceResponseInterceptor';

export default class TestServerResponseInterceptor implements ServiceResponseInterceptor<any> {
	execute(response: any): Promise<any> {
		response.l = 'L';
		return response;
	}
}
