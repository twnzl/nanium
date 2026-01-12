import { expect } from 'vitest';
import { Nanium } from '../../core';
import { AsyncHelper } from '../../helper';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { NaniumLogger } from '../../interfaces/logger';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';
import { NaniumConsumerBrowserHttp } from '../../managers/consumers/browserHttp';
import { NaniumConsumerBrowserWebsocket } from '../../managers/consumers/browserWs';
import { NaniumProviderBrowser } from '../../managers/providers/browser';
import { NaniumJsonSerializer } from '../../serializers/json';
import { Stuff2Event } from '../events/test/stuff2Event';
import { StuffEvent } from '../events/test/stuffEvent';
import { TestClientRequestInterceptor } from '../interceptors/client/test.request.interceptor';
import { TestClientResponseInterceptor } from '../interceptors/client/test.response.interceptor';
import { TestEventSubscriptionSendInterceptor } from '../interceptors/client/test.send-event-subscription.interceptor';
import { ServiceResponseBase } from '../services/serviceResponseBase';
import { AnonymousRequest } from '../services/test/anonymous.contract';
import { TestBufferRequest } from '../services/test/buffer.contract';
import { TestDto } from '../services/test/contractparts';
import { TestGetRequest, TestGetResponse, TestGetResponseBody } from '../services/test/get.contract';
import { TestGetNaniumBufferRequest } from '../services/test/getNaniumBuffer.contract';
import { TestNoIORequest } from '../services/test/noIO.contract';
import { TestStreamedBinaryRequest } from '../services/test/streamedBinary.contract';
import { TestStreamedQueryRequest } from '../services/test/streamedQuery.contract';
import { TestStreamsRequest } from '../services/test/streams.contract';
import { session } from '../session';

export class TestCore {

	static async addHttpConsumer(
		baseUrl: string = 'http://localhost:8080',
		serviceResponsibility: number = 1,
		eventResponsibility: number = 1
	): Promise<NaniumConsumerBrowserHttp> {
		const serializer = new NaniumJsonSerializer();
		serializer.packageSeparator = '\0';
		const naniumConsumer = new NaniumConsumerBrowserHttp({
			apiUrl: baseUrl + '/api',
			apiEventUrl: baseUrl + '/events',
			serializer: serializer,
			requestInterceptors: [TestClientRequestInterceptor],
			responseInterceptors: [TestClientResponseInterceptor],
			eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
			isResponsible: () => Promise.resolve(serviceResponsibility),
			isResponsibleForEvent: () => Promise.resolve(eventResponsibility),
			handleError: async (err: any): Promise<any> => Promise.reject({ handleError: err })
		});
		await Nanium.addManager(naniumConsumer);
		return naniumConsumer;
	}

	static async addWebsocketConsumer(
		baseUrl: string = 'ws://localhost:8080',
		serviceResponsibility: number = 1,
		eventResponsibility: number = 1
	): Promise<NaniumConsumerBrowserWebsocket> {
		const serializer = new NaniumJsonSerializer();
		serializer.packageSeparator = '\0';
		const naniumConsumer = new NaniumConsumerBrowserWebsocket({
			connectUrl: baseUrl,
			serializer: serializer,
			requestInterceptors: [TestClientRequestInterceptor],
			responseInterceptors: [TestClientResponseInterceptor],
			eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
			isResponsible: () => Promise.resolve(serviceResponsibility),
			isResponsibleForEvent: () => Promise.resolve(eventResponsibility),
			handleError: (err: any) => Promise.reject({ handleError: err }),
		});
		await Nanium.addManager(naniumConsumer);
		return naniumConsumer;
	}

	static async normalSuccessfulExecution() {
		const response: ServiceResponseBase<TestGetResponseBody> = await new TestGetRequest({ input1: 'hello world' }).execute();
		expect(response?.body?.output1).toBe('hello world :-)');
		expect(response?.body?.output2).toBe(2);
	}

	static async skipInterceptor() {
		const anonymousRequest: AnonymousRequest = new AnonymousRequest(undefined, {});
		const anonymousResponse: ServiceResponseBase<string> = await anonymousRequest.execute();
		expect(anonymousResponse.body).toBe(':-)'); // output should be correct
	}

	static async responseInterceptor() {
		let response: ServiceResponseBase<TestGetResponseBody>;
		TestClientResponseInterceptor.responseCnt = 0;
		response = await new TestGetRequest({ input1: '111' }).execute();
		expect(response?.body?.output1).toBe('111 :-)'); // output1 should be the original result from the service executor
		expect(TestClientResponseInterceptor.responseCnt).toBe(1);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnDifferentResponse' }).execute();
		expect(response?.body?.output1).toBe('ResultFromInterceptor'); // output1 should be the result that the interceptor returned
		expect(TestClientResponseInterceptor.responseCnt).toBe(2);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnNull' }).execute();
		expect(response).toBeNull(); // response should be null because interceptor returned null
		expect(TestClientResponseInterceptor.responseCnt).toBe(3);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnUndefined' }).execute();
		expect(response.body.output1).toBe('TestResponseInterceptor:ReturnUndefined :-)'); // output1 should be the original result from the service executor, because interceptor returned undefined
		expect(TestClientResponseInterceptor.responseCnt).toBe(4);
		response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnSameResponseInstance' }).execute();
		expect(response.body.output1).toBe('TestResponseInterceptor:ReturnSameResponseInstance :-)'); // output1 should be the original result from the service executor, because interceptor returned original response instance
		expect(TestClientResponseInterceptor.responseCnt).toBe(5);
	}

	static async withErrorResult() {
		try {
			await new TestGetRequest({ input1: 'hello world' }, { token: 'wrong' }).execute();
			expect(false).toBeTruthy(); // an exception should be thrown
		} catch (e) {
			expect(e.handleError).toBeDefined(); // the errorHandler function should have handled the error
			expect(e.handleError.message).toBe('unauthorized');
		}
	}

	static async voidBodyAndVoidResponse() {
		await new TestNoIORequest().execute();
		expect(true).toBeTruthy();
	}

	static async naniumBufferResponse() {
		const result: NaniumBuffer = await new TestGetNaniumBufferRequest().execute();
		expect(await result.asString()).toBe('this is a text that will be send as NaniumBuffer');
	}

	static async naniumBuffersRequest(includeBuffer2: boolean = true) {
		const request = new TestBufferRequest({
			id: '1',
			buffer1: new NaniumBuffer().writeString('123'),
			buffer2: includeBuffer2 ? new NaniumBuffer().writeString('456') : undefined
		});
		const response = await request.execute();
		expect(response.id).toBe('1');
		expect(response.text1).toBe('123*');
		expect(response.text2).toBe(includeBuffer2 ? '456*' : undefined);
		return response;
	}

	static async responseAsJsonStream() {
		const dtoList: TestDto[] = [];
		let portions = 0;
		try {
			const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
				{ amount: 6, msGapTime: 100 }, { token: '1234' }).execute();
			for await (const chunk of response) {
				portions++;
				dtoList.push(chunk);
			}
		}
		catch (err) {
			NaniumLogger.error(err.message, err.stack);
		}
		expect(portions).toBe(6); // result array should be returned in multiple portions
		expect(dtoList.length).toBe(6); // length of result list should be correct
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async responseAsJsonStreamToPromise() {
		const responseStream: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
			{ amount: 6, msGapTime: 0 }, { token: '1234' }).execute();
		const dtoList: TestDto[] = await responseStream.toPromise();
		expect(dtoList.length).toBe(6); // length of result list should be correct
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async naniumBuffersRequestWithOneUndefined() {
		const request = new TestBufferRequest({
			id: '1',
			buffer1: new NaniumBuffer().writeString('123'),
			buffer2: undefined
		});
		const response = await request.execute();
		expect(response.id).toBe('1');
		expect(response.text1).toBe('123*');
		expect(response.text2).toBeUndefined();
		return response;
	}

	static async naniumStreamJson() {
		const dtoList: TestDto[] = [];
		let portions = 0;
		try {
			const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
				{ amount: 6, msGapTime: 100 }, { token: '1234' }).execute();
			for await (const chunk of response) {
				portions++;
				dtoList.push(chunk);
			}
		}
		catch (err) {
			NaniumLogger.error(err.message, err.stack);
		}
		expect(portions).toBe(6); // result array should be returned in multiple portions
		expect(dtoList.length).toBe(6); // length of result list should be correct
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async naniumStreamToPromise() {
		const responseStream: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
			{ amount: 6, msGapTime: 0 }, { token: '1234' }).execute();
		const dtoList: TestDto[] = await responseStream.toPromise();
		expect(dtoList.length).toBe(6); // length of result list should be correct
		expect(dtoList[0].formatted()).toBe('1:1');
		expect(dtoList[2].formatted()).toBe('3:3');
	}

	static async naniumStreamBinary() {
		const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();
		const result: NaniumBuffer = new NaniumBuffer();
		for await (const chunk of stream) {
			result.write(chunk);
		}
		expect(await result.asString()).toBe('1.2.3.');
	}

	static async responseAsBinaryStream() {
		const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();
		const result: NaniumBuffer = new NaniumBuffer();
		for await (const chunk of stream) {
			result.write(chunk);
		}
		expect(await result.asString()).toBe('1.2.3.');
	}

	static async naniumStreamsInResponse() {
		const request = new TestStreamsRequest({
			id: '1',
			stream1: new NaniumStream(),
			stream2: new NaniumStream(),
		});
		request.body.stream1.write(new TextEncoder().encode('123'));
		request.body.stream2.write(new TextEncoder().encode('456'));
		request.body.stream1.end();
		request.body.stream2.end();
		const response = await request.execute();
		const data1: NaniumBuffer = new NaniumBuffer();
		const data2: NaniumBuffer = new NaniumBuffer();
		await Promise.all([
			(async () => {
				for await (const chunk of response.stream1) {
					data1.write(chunk);
				}
			})(),
			(async () => {
				for await (const chunk of response.stream2) {
					data2.write(chunk);
				}
			})()
		]);
		expect(await data1.asString()).toBe('123*');
		expect(await data2.asString()).toBe('456*');
	}

	static async responsibilityForRequestsTest() {
		const mockServerProvider = new NaniumProviderBrowser({
			isResponsible: async (request, serviceName) => {
				return Promise.resolve(serviceName.startsWith('NaniumTest:') ? 9 : 0);
			},
			isResponsibleForEvent: async (eventName) => {
				return Promise.resolve(eventName.startsWith('NaniumTest:') ? 9 : 0);
			}
		});
		void Nanium.addManager(mockServerProvider);

		mockServerProvider.addService(
			TestGetRequest,
			class {
				async execute(_request: TestGetRequest): Promise<TestGetResponse> {
					return Promise.resolve(
						new TestGetResponse({
							output1: 'mock1',
							output2: 2222,
						})
					);
				}
			}
		);
		const result = await new TestGetRequest().execute();
		expect(result.body.output1).toBe('mock1');
		expect(result.body.output2).toBe(2222);
	}


	//#region events
	static async subscribeWithWrongAuthToken(manager: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket) {
		let subscription: EventSubscription;
		try {
			session.token = 'wrong!!';
			// should call the client interceptor that adds credentials, but they are wrong
			subscription = await StuffEvent.subscribe(() => {}, undefined, manager);
			expect(true).toBeFalsy(); // an exception should have been thrown
		} catch (e) {
			expect(e.message).toBe('unauthorized');
		} finally {
			session.token = '1234'; // reset right credentials
			await subscription?.unsubscribe();
		}
	}

		static async interProcessEventEmission(
			manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
			manager2: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
			manager3: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
		) {
			let subscription1: EventSubscription;
			let subscription2: EventSubscription;
			let subscription3: EventSubscription;
			session.token = '1234'; // reset right credentials
			let event1: StuffEvent;
			let event2: StuffEvent;
			let event3: StuffEvent;
			let eventCount = 0;
			await (async () => {
				subscription1 = await StuffEvent.subscribe((event) => {
					event1 = event;
					eventCount++;
					if (event2 && event3) {
						return;
					}
				}, undefined, manager1);
				subscription2 = await StuffEvent.subscribe((event) => {
					event2 = event;
					eventCount++;
					if (event1 && event3) {
						return
					}
				}, undefined, manager2);
				subscription3 = await StuffEvent.subscribe((event) => {
					event3 = event;
					eventCount++;
					if (event1 && event2) {
						return
					}
				}, undefined, manager3);
				await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
			})();
			await AsyncHelper.pause(1000);
			await subscription1.unsubscribe();
			await subscription2.unsubscribe();
			await subscription3.unsubscribe();
			expect(event1.aNumber).toBe(9);
			expect(event1.aString).toBe('10');
			expect(event1.aDate?.toISOString()).toBe(new Date(2011, 11, 11).toISOString());
			expect(event2.aNumber).toBe(9);
			expect(event2.aString).toBe('10');
			expect(event2.aDate?.toISOString()).toBe(new Date(2011, 11, 11).toISOString());
			expect(event3.aNumber).toBe(9);
			expect(event3.aString).toBe('10');
			expect(event3.aDate?.toISOString()).toBe(new Date(2011, 11, 11).toISOString());
			expect(eventCount).toBe(3);
		}

	static async unsubscribeWithoutParameters(
		manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
		unsubscribeWithManager: boolean = true
	) {
		session.token = '1234'; // reset right credentials
		let event1: StuffEvent;
		let event2: Stuff2Event;
		await StuffEvent.subscribe((event) => event1 = event, undefined, manager1);
		await Stuff2Event.subscribe((event) => event2 = event, undefined, manager1);
		await Stuff2Event.unsubscribe(unsubscribeWithManager ? manager1 : undefined);
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		await AsyncHelper.pause(1000);
		await StuffEvent.unsubscribe();
		// wahrscheinlich bleiben hier unsubscribe responses OffscreenCanvas,
		// so dass der socket nach dem Test nicht geschlossen wird
		expect(event1.aNumber).toBe(9);
		expect(event1.aString).toBe('10');
		expect(event1.aDate?.toISOString()).toBe(new Date(2011, 11, 11).toISOString());
		expect(event2).toBeUndefined();
	}

	static async eventEmissionInterceptor(
		manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
		manager2: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
	) {
		// debugger;
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		let event1: StuffEvent;
		let event2: StuffEvent;
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		const subscription1: EventSubscription = await StuffEvent.subscribe((event) => {
			event1 = event;
		}, undefined, manager1);
		session.token = '5678'; // other tenant
		session.tenant = 'Company2';
		const subscription2: EventSubscription = await StuffEvent.subscribe((event) => {
			event2 = event;
		}, undefined, manager2);
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		// await AsyncHelper.waitUntil(() => !!event1, 100, 2000);
		await AsyncHelper.pause(1000);
		await subscription1.unsubscribe();
		await subscription2.unsubscribe();
		expect(event1.aNumber).toBe(9);
		expect(event1.aString).toBe('10');
		expect(event1.aDate?.toISOString()).toBe(new Date(2011, 11, 11).toISOString());
		expect(subscription2).toBeDefined();
		expect(event2).toBeUndefined();
	}

	static async subscribeEventByName(
		manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
	) {
		// session.token = '1234'; // reset right credentials
		let event1: StuffEvent;
		const subscription1 = await Nanium.subscribe(StuffEvent.eventName, (event) => {
			event1 = event;
			return Promise.resolve();
		}, undefined, manager1);
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffEvent
		await AsyncHelper.pause(1000);
		await subscription1.unsubscribe();
		expect(event1.aNumber).toBe(9);
		expect(event1.aString).toBe('10');
		expect(event1.aDate as any).toBe(new Date(2011, 11, 11).toISOString());
	}

	static async responsibilityForEventsTest() {
		const mockServerProvider = new NaniumProviderBrowser({
			isResponsible: async (request, serviceName) => {
				return Promise.resolve(serviceName.startsWith('NaniumTest:') ? 9 : 0);
			},
			isResponsibleForEvent: async (eventName) => {
				return Promise.resolve(eventName.startsWith('NaniumTest:') ? 9 : 0);
			}
		});
		void Nanium.addManager(mockServerProvider);
		await StuffEvent.subscribe((evt: StuffEvent) => {
			expect(evt.aString).toBe(':-)');
		});
		new StuffEvent(42, ':-)', new Date(2021, 12, 6)).emit();
	}
	//#endregion events
}
