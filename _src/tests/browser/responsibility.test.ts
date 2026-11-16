import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Nanium } from '../../core.js';
import { NaniumConsumerBrowserHttp } from '../../managers/consumers/browserHttp.js';
import { NaniumProviderBrowser } from '../../managers/providers/browser.js';
import { NaniumJsonSerializer } from '../../serializers/json.js';
import { ClientServiceExecutionContext } from '../browser-client/src/services/clientServiceExecutionContext.js';
import { StuffGetRequest } from '../browser-client/src/services/stuff/get.contract.js';
import { StuffGetExecutor } from '../browser-client/src/services/stuff/get.executor.js';
import { TestClientRequestInterceptor } from '../interceptors/client/test.request.interceptor.js';
import { TestClientResponseInterceptor } from '../interceptors/client/test.response.interceptor.js';
import { ServiceRequestBase } from '../services/serviceRequestBase.js';

function initNanium(baseUrl: string = 'http://localhost:8080'): void {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		handleError: (err: any): Promise<any> => {
			throw { handleError: err };
		},
		isResponsible: async (request, serviceName) => {
			return Promise.resolve(serviceName.startsWith('NaniumTest:') ? 2 : 0);
		},
		isResponsibleForEvent: async (eventName) => {
			return Promise.resolve(eventName.startsWith('NaniumTest:') ? 2 : 0);
		},
	});
	void Nanium.addManager(naniumConsumer);
}

describe('test browser client with mocked server', () => {
	const browserProvider = new NaniumProviderBrowser({
		isResponsible: async (_request, serviceName) => {
			return Promise.resolve(serviceName.startsWith('NaniumClientTest:') ? 2 : 0);
		},
		isResponsibleForEvent: async (eventName) => {
			return Promise.resolve(eventName.startsWith('NaniumClientTest:') ? 2 : 0);
		},
		requestInterceptors: [new class {
			async execute(request: ServiceRequestBase<any, any>, context: ClientServiceExecutionContext): Promise<ServiceRequestBase<any, any>> {
				context.user = { id: 1, name: 'TestUser' };
				return Promise.resolve(request);
			}
		}]
	});

	beforeEach(async () => {
		initNanium();
		void Nanium.addManager(browserProvider);
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
