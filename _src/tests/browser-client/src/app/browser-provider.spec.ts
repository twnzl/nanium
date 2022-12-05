import { NaniumJsonSerializer } from '../../../../serializers/json';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { Nanium } from '../../../../core';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { NaniumProviderBrowser } from '../../../../managers/providers/browser';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import { ServiceRequestBase } from '../../../services/serviceRequestBase';
import { StuffGetRequest } from '../services/stuff/get.contract';
import { StuffGetExecutor } from '../services/stuff/get.executor';
import { ClientServiceExecutionContext } from '../services/clientServiceExecutionContext';

function initNanium(baseUrl: string = 'http://localhost:8080'): void {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		},
		isResponsible: async (request, serviceName) => {
			return serviceName.startsWith('NaniumTest:') ? 2 : 0;
		},
		isResponsibleForEvent: async (eventName) => {
			return eventName.startsWith('NaniumTest:') ? 2 : 0;
		},
	});
	Nanium.addManager(naniumConsumer).then();
}

describe('test browser client with mocked server', () => {
	const browserProvider = new NaniumProviderBrowser({
		isResponsible: async (request, serviceName) => {
			return serviceName.startsWith('NaniumClientTest:') ? 2 : 0;
		},
		isResponsibleForEvent: async (eventName) => {
			return eventName.startsWith('NaniumClientTest:') ? 2 : 0;
		},
		requestInterceptors: [new class {
			async execute(request: ServiceRequestBase<any, any>, context: ClientServiceExecutionContext): Promise<ServiceRequestBase<any, any>> {
				context.user = { id: 1, name: 'TestUser' };
				return request;
			}
		}]
	});

	beforeEach(async () => {
		initNanium();
		Nanium.addManager(browserProvider).then();
	});

	afterEach(async () => {
		await Nanium.shutdown();
	});

	it('normal execution via request.execute() should choose the browser and the interceptor has to be run', async function (): Promise<void> {
		browserProvider.addService(StuffGetRequest, StuffGetExecutor);
		const result = await new StuffGetRequest().execute();
		expect(result.value).toBe('TestUser');
	});
});
