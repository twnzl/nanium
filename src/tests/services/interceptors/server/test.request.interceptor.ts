import { ServiceRequestInterceptor } from '../../../../interfaces/serviceRequestInterceptor';

export class TestServerRequestInterceptor implements ServiceRequestInterceptor<any> {
	execute(request: any, scope?: string): Promise<any> {
		request.v = 45;
		return request;
	}
}
