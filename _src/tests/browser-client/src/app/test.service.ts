import { Injectable } from '@angular/core';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import {
	TestEventSubscriptionSendInterceptor
} from '../../../interceptors/client/test.send-event-subscription.interceptor';
import { Nanium } from '../../../../core';
import { NaniumProviderBrowser } from '../../../../managers/providers/browser';
import { ServiceRequestBase } from '../../../services/serviceRequestBase';
import { ClientServiceExecutionContext } from '../services/clientServiceExecutionContext';
import { NaniumConsumerBrowserWebsocket } from '../../../../managers/consumers/browserWs';

@Injectable({
	providedIn: 'root'
})
export class TestService {
	browserProvider = new NaniumProviderBrowser({
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

	jsonSerializer = new NaniumJsonSerializer('\0');

	naniumConsumerHttp: NaniumConsumerBrowserHttp;
	naniumConsumerWs: NaniumConsumerBrowserWebsocket;

	constructor() {
	}

	async init(apiPort: 8080 | 8081 = 8080, eventPort: 8080 | 8081 = 8080): Promise<void> {
		this.naniumConsumerHttp = new NaniumConsumerBrowserHttp({
			apiUrl: `http://localhost:${apiPort}/api`,
			apiEventUrl: `http://localhost:${eventPort}/events`,
			serializer: this.jsonSerializer,
			requestInterceptors: [TestClientRequestInterceptor],
			responseInterceptors: [TestClientResponseInterceptor],
			eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
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
		this.naniumConsumerWs = new NaniumConsumerBrowserWebsocket({
			apiEventUrl: `ws://localhost:${eventPort}`,
			serializer: this.jsonSerializer,
			requestInterceptors: [TestClientRequestInterceptor],
			responseInterceptors: [TestClientResponseInterceptor],
			eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
			handleError: async (err: any): Promise<any> => {
				throw { handleError: err };
			},
			isResponsible: async (request, serviceName) => {
				return 0;
			},
			isResponsibleForEvent: async (eventName) => {
				return eventName.startsWith('NaniumTest:') ? 1 : 0;
			},
		});
		Nanium.addManager(this.naniumConsumerHttp).then();
		Nanium.addManager(this.naniumConsumerWs).then();
		Nanium.addManager(this.browserProvider).then();
	}

	async shutdown(): Promise<void> {
		await Nanium.shutdown();
	}
}
