import ServiceRequestInterceptor from '../../../../interfaces/serviceRequestInterceptor';
import {ServiceRequestBase} from '../../../../bases/request.base';

export default class TestClientRequestInterceptor implements ServiceRequestInterceptor {
	config: {
		language: string;
		apiVersion: string;
	};

	static create(config: any): ServiceRequestInterceptor {
		const result: TestClientRequestInterceptor = new TestClientRequestInterceptor();
		result.config = config;
		return result;
	}

	async execute<T extends ServiceRequestBase<any, any>>(request: T, scope?: string): Promise<ServiceRequestBase<any, any>> {
		// e.g. add some authorization data like a token from the any kind of Session
		request.head = {
			apiVersion: '45'
		};

		return request;
	}
}
