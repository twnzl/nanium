import { ServiceRequestInterceptor } from '../../../../interfaces/serviceRequestInterceptor';

export class TestClientRequestInterceptor implements ServiceRequestInterceptor<any> {
	config: {
		language: string;
		apiVersion: string;
	};

	static create(config: any): ServiceRequestInterceptor<any> {
		const result: TestClientRequestInterceptor = new TestClientRequestInterceptor();
		result.config = config;
		return result;
	}

	execute(request: any, scope?: string): Promise<any> {
		request.head = {
			apiVersion: '45'
		};
		return request;
	}

}
