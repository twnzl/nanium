import { Nanium } from '../../../../core';
import { AsyncHelper } from '../../../../helper';
import { EventSubscription } from '../../../../interfaces/eventSubscription';
import { LogLevel } from '../../../../interfaces/logger';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { NaniumConsumerBrowserWebsocket } from '../../../../managers/consumers/browserWs';
import { NaniumProviderBrowser } from '../../../../managers/providers/browser';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { Stuff2Event } from '../../../events/test/stuff2Event';
import { StuffEvent } from '../../../events/test/stuffEvent';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import {
	TestEventSubscriptionSendInterceptor
} from '../../../interceptors/client/test.send-event-subscription.interceptor';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { TestGetRequest, TestGetResponse } from '../../../services/test/get.contract';
import { TimeRequest } from '../../../services/test/time.contract';
import { session } from '../../../session';
import { TestLogger } from '../../../testLogger';
import { TestCore } from './test-core';

async function addHttpConsumer(
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
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		}
	});
	await Nanium.addManager(naniumConsumer);
	return naniumConsumer;
}

async function addWebsocketConsumer(
	baseUrl: string = 'ws://localhost:8080',
	serviceResponsibility: number = 1,
	eventResponsibility: number = 1
): Promise<NaniumConsumerBrowserWebsocket> {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserWebsocket({
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
		isResponsible: () => Promise.resolve(serviceResponsibility),
		isResponsibleForEvent: () => Promise.resolve(eventResponsibility),
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		}
	});
	await Nanium.addManager(naniumConsumer);
	return naniumConsumer;
}

describe('', function (): void {
	beforeEach(async function (): Promise<void> {
		Nanium.logger = new TestLogger(LogLevel.error);
	});

	describe('basic browser client tests (HTTP)', () => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

		beforeEach(async () => {
			session.token = '1234';
			session.tenant = 'Company1';
			await addHttpConsumer();
		});

		afterEach(async () => {
			await Nanium.shutdown();
			session.token = '1234';
			session.tenant = 'Company1';
		});

		describe('execute request via the consumer \n', function (): void {

			it('normal successful execution', async () => {
				await TestCore.normalSuccessfulExecution();
			});

			it('execute and skip interceptor', async function (): Promise<void> {
				await TestCore.skipInterceptor();
			});

			it('test response interceptor\n', async function (): Promise<void> {
				await TestCore.responseInterceptor();
			});

			it('execute with error result (handling by errorHandle)', async () => {
				await TestCore.withErrorResult();
			});

			it('execute service with void body and void response', async () => {
				await TestCore.voidBodyAndVoidResponse();
			});

			it('execute service with Binary (NaniumBuffer) response', async () => {
				await TestCore.naniumBufferResponse();
			});

			it('response as json stream', async () => {
				await TestCore.naniumStreamJson();
			});

			it('response as json stream toPromise()', async () => {
				await TestCore.naniumStreamToPromise();
			});

			it('response as binary stream', async () => {
				await TestCore.naniumStreamBinary();
			});

			it('call an url of the http server that is not managed by nanium', async () => {
				const result: any = await new Promise<any>(resolve => {
					fetch('http://localhost:8080/stuff').then(async response => {
						let str: string = await response.text();
						resolve(str);
					});
				});
				expect(result)
					.withContext('the original request listener of the server should have handled the request')
					.toBe('*** http fallback ***');
			});

			it('body = undefined\n', async function (): Promise<void> {
				const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute();
				expect(result.body).toBe(undefined);
			});

			it('body = Date\n', async function (): Promise<void> {
				const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute();
				expect(result.body.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
			});

			it('NaniumBuffers in request \n', async function (): Promise<void> {
				await TestCore.naniumBuffersRequest();
			});

			it('NaniumBuffers in request but one is undefined \n', async function (): Promise<void> {
				await TestCore.naniumBuffersRequestWithOneUndefined();
			});
		});

		describe('NaniumBuffer \n', function (): void {
			const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
			const blob = new Blob(['def']);
			const file: File = new File([new Blob(['fff'])], 'test.bin');
			const uint8Array = new TextEncoder().encode('jkl');

			describe('asString', function (): void {
				it('with different types in constructor', async function (): Promise<void> {
					const buf = new NaniumBuffer([
						arrayBuffer, blob, uint8Array, file
					]);
					expect(buf.id?.length > 0).toBeTruthy();
					expect(await buf.asString()).toBe('abcdefjklfff');
				});

				it('asString with a single arrayBuffer', async function (): Promise<void> {
					const buf = new NaniumBuffer([arrayBuffer]);
					expect(await buf.asString()).toBe('abc');
				});

				it('asString write multiple different types', async function (): Promise<void> {
					const buf = new NaniumBuffer(undefined, '1');
					expect(buf.id).toBe('1');
					buf.write(arrayBuffer);
					buf.write(blob);
					buf.write(uint8Array);
					buf.write(file);
					expect(await buf.asString()).toBe('abcdefjklfff');
				});
			});

			describe('asUInt8Array', function (): void {
				it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
					const buf = new NaniumBuffer([
						arrayBuffer, blob, uint8Array, file
					]);
					expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklfff');
				});

				it('asUInt8Array with a single arrayBuffer', async function (): Promise<void> {
					const buf = new NaniumBuffer([arrayBuffer]);
					expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abc');
				});

				it('asUInt8Array with a single Blob', async function (): Promise<void> {
					const buf = new NaniumBuffer([blob]);
					expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('def');
				});

				it('asUInt8Array with a single File', async function (): Promise<void> {
					const buf = new NaniumBuffer([file]);
					expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('fff');
				});
			});

			describe('as())', function (): void {
				it('as(Blob) with different types in constructor \n', async function (): Promise<void> {
					const buf = new NaniumBuffer([
						arrayBuffer, blob, uint8Array, file
					]);
					const b = await buf.as(Blob);
					expect(b instanceof Blob).toBeTruthy();
					expect(new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()))).toBe('abcdefjklfff');
				});
			});

			describe('splice())', function (): void {
				it('splice(Buffer) with different types in constructor \n', async function (): Promise<void> {
					const buf = new NaniumBuffer([
						arrayBuffer, blob, uint8Array, file
					]);
					expect(await buf.slice(3, 6).asString()).toBe('def');
					expect(await buf.slice(3, 5).asString()).toBe('de');
					expect(await buf.slice(4, 6).asString()).toBe('ef');
					expect(await buf.slice(4, 7).asString()).toBe('efj');
					expect(await buf.slice(9, 12).asString()).toBe('fff');
					expect(await buf.slice(2, 7).asString()).toBe('cdefj');
				});
			});
		});
	});

	describe('basic browser client tests (Websocket)', () => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

		beforeEach(async () => {
			session.token = '1234';
			session.tenant = 'Company1';
			await addWebsocketConsumer();
		});

		afterEach(async () => {
			await Nanium.shutdown();
			session.token = '1234';
			session.tenant = 'Company1';
		});

		describe('execute request via the consumer \n', function (): void {

			it('normal successful execution', async () => {
				try {
					await TestCore.normalSuccessfulExecution();
				} catch (e) {
					console.error(JSON.stringify(e, null, 2));
					throw e;
				}
			});

			it('execute and skip interceptor', async function (): Promise<void> {
				await TestCore.skipInterceptor();
			});

			it('test response interceptor\n', async function (): Promise<void> {
				await TestCore.responseInterceptor();
			});

			it('execute with error result (handling by errorHandle)', async () => {
				await TestCore.withErrorResult();
			});

			it('execute service with void body and void response', async () => {
				await TestCore.voidBodyAndVoidResponse();
			});

			it('execute service with Binary (NaniumBuffer) response', async () => {
				await TestCore.naniumBufferResponse();
			});

			it('NaniumBuffers in request and response \n', async function (): Promise<void> {
				await TestCore.naniumBuffersRequest();
			});

			it('NaniumBuffers in request and response but one is undefined \n', async function (): Promise<void> {
				await TestCore.naniumBuffersRequestWithOneUndefined();
			});


			it('response as json stream', async () => {
				await TestCore.naniumStreamJson();
			});

			it('response as json stream toPromise()', async () => {
				await TestCore.naniumStreamToPromise();
			});

			it('response as binary stream', async () => {
				await TestCore.naniumStreamBinary();
			});

			it('response with multiple streams', async () => {
				await TestCore.naniumStreamsInResponse();
			});

		});
	});

	describe('test browser client with wrong api url', () => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

		beforeEach(async () => {
			await addHttpConsumer('https://not.available');
		});

		afterEach(async () => {
			await Nanium.shutdown();
		});

		it('execute with connection error', async () => {
			try {
				await new TestGetRequest({ input1: 'hello world' }).execute();
				expect(false).withContext('an exception should be thrown').toBeTruthy();
			} catch (e) {
				expect(e).withContext('an exception should be thrown').toBeDefined();
			}
		});
	});

	describe('test browser client with mocked server', () => {
		const mockServerProvider = new NaniumProviderBrowser({
			isResponsible: async (request, serviceName) => {
				return serviceName.startsWith('NaniumTest:') ? 2 : 0;
			},
			isResponsibleForEvent: async (eventName) => {
				return eventName.startsWith('NaniumTest:') ? 2 : 0;
			}
		});

		beforeEach(async () => {
			await addHttpConsumer();
			Nanium.addManager(mockServerProvider).then();
		});

		afterEach(async () => {
			await Nanium.shutdown();
		});

		it('normal execution via request.execute() should choose the mock implementation', async function (): Promise<void> {
			mockServerProvider.addService(
				TestGetRequest,
				class {
					async execute(_request: TestGetRequest): Promise<TestGetResponse> {
						return new TestGetResponse({
							output1: 'mock1',
							output2: 2222,
						});
					}
				}
			);
			const result = await new TestGetRequest().execute();
			expect(result.body.output1).toBe('mock1');
			expect(result.body.output2).toBe(2222);
		});

		it('normal event subscription and emission should choose the Mock implementation', async function (): Promise<void> {
			await StuffEvent.subscribe((evt: StuffEvent) => {
				expect(evt.aString).toBe(':-)');
			});
			new StuffEvent(42, ':-)', new Date(2021, 12, 6)).emit();
		});
	});

	describe('events and inter-process communication via cluster communicator', () => {
		afterEach(async () => {
			await Nanium.shutdown();
		});

		async function withWrongAuthToken(manager: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket) {
			let subscription;
			try {
				session.token = 'wrong!!';
				// should call the client interceptor that adds credentials, but they are wrong
				subscription = await StuffEvent.subscribe(() => {
				}, undefined, manager);
				expect(true).withContext('an exception should have been thrown').toBeFalse();
			} catch (e) {
				expect(e.message).toBe('unauthorized');
			} finally {
				subscription?.unsubscribe();
				session.token = '1234'; // reset right credentials
			}
		}

		async function interProcessEventEmission(
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
			await new Promise<void>(async (resolve: Function) => {
				subscription1 = await StuffEvent.subscribe((event) => {
					event1 = event;
					eventCount++;
					if (event2 && event3) {
						resolve();
					}
				}, undefined, manager1);
				subscription2 = await StuffEvent.subscribe((event) => {
					event2 = event;
					eventCount++;
					if (event1 && event3) {
						resolve();
					}
				}, undefined, manager2);
				subscription3 = await StuffEvent.subscribe((event) => {
					event3 = event;
					eventCount++;
					if (event1 && event2) {
						resolve();
					}
				}, undefined, manager3);
				await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
			});
			await AsyncHelper.pause(1000);
			await subscription1.unsubscribe();
			await subscription2.unsubscribe();
			await subscription3.unsubscribe();
			expect(event1.aNumber).withContext('event1: aNumber should be correct').toBe(9);
			expect(event1.aString).withContext('event1: aString should be correct').toBe('10');
			expect(event1.aDate?.toISOString()).withContext('event1: aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
			expect(event2.aNumber).withContext('event2: aNumber should be correct').toBe(9);
			expect(event2.aString).withContext('event2: aString should be correct').toBe('10');
			expect(event2.aDate?.toISOString()).withContext('event2: aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
			expect(event3.aNumber).withContext('event3: aNumber should be correct').toBe(9);
			expect(event3.aString).withContext('event3: aString should be correct').toBe('10');
			expect(event3.aDate?.toISOString()).withContext('event3: aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
			expect(eventCount).toBe(3);
		}

		async function unsubscribeWithoutParameters(
			manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket
		) {
			session.token = '1234'; // reset right credentials
			let event1: StuffEvent;
			let event2: Stuff2Event;
			await StuffEvent.subscribe((event) => event1 = event, undefined, manager1);
			await Stuff2Event.subscribe((event) => event2 = event, undefined, manager1);
			await Stuff2Event.unsubscribe();
			await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
			await AsyncHelper.pause(1000);
			await StuffEvent.unsubscribe();
			expect(event1.aNumber).withContext('aNumber should be correct').toBe(9);
			expect(event1.aString).withContext('aString should be correct').toBe('10');
			expect(event1.aDate?.toISOString()).withContext('aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
			expect(event2).toBeUndefined();
		}

		async function eventEmissionInterceptor(
			manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
			manager2: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
		) {
			let subscription1: EventSubscription;
			let subscription2: EventSubscription;
			session.token = '1234'; // reset right credentials
			session.tenant = 'Company1';
			let event1: StuffEvent;
			let event2: StuffEvent;
			session.token = '1234'; // reset right credentials
			session.tenant = 'Company1';
			subscription1 = await StuffEvent.subscribe((event) => {
				event1 = event;
			}, undefined, manager1);
			session.token = '5678'; // other tenant
			session.tenant = 'Company2';
			subscription2 = await StuffEvent.subscribe((event) => {
				event2 = event;
			}, undefined, manager2);
			session.token = '1234'; // reset right credentials
			session.tenant = 'Company1';
			await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
			await AsyncHelper.pause(1000);
			// await AsyncHelper.waitUntil(() => !!subscription1 && !!subscription2, 100, 2000);
			await subscription1.unsubscribe();
			await subscription2.unsubscribe();
			expect(event1.aNumber).withContext('aNumber should be correct').toBe(9);
			expect(event1.aString).withContext('aString should be correct').toBe('10');
			expect(event1.aDate?.toISOString()).withContext('aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
			expect(subscription2).withContext('subscription 2 should be defined').toBeDefined();
			expect(event2).withContext('event 2 should be undefined (not raised for second subscription because it was made as a different tenant)').toBeUndefined();
		}

		async function subscribeEventByName(
			manager1: NaniumConsumerBrowserHttp | NaniumConsumerBrowserWebsocket,
		) {
			// session.token = '1234'; // reset right credentials
			let event1;
			const subscription1 = await Nanium.subscribe(StuffEvent.eventName, async (event) => {
				event1 = event;
			}, undefined, manager1);
			await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffEvent
			await AsyncHelper.pause(1000);
			await subscription1.unsubscribe();
			expect(event1.aNumber).withContext('aNumber should be correct').toBe(9);
			expect(event1.aString).withContext('aString should be correct').toBe('10');
			expect(event1.aDate as any).withContext('aDate is an ISOString because subscription without event constructor does not support real types').toBe(new Date(2011, 11, 11).toISOString());
		}

		describe('events over http channel', function (): void {
			let manager1: NaniumConsumerBrowserHttp;
			let manager2: NaniumConsumerBrowserHttp;
			let manager3: NaniumConsumerBrowserHttp;

			beforeEach(async () => {
				session.token = '1234';
				session.tenant = 'Company1';
				manager1 = await addHttpConsumer('http://localhost:8080');
				manager2 = await addHttpConsumer('http://localhost:8081');
				manager3 = await addHttpConsumer('http://localhost:8081'); // for two different client-IDs connected with the same server
				Nanium.logger = new TestLogger(LogLevel.error);
			});

			it('subscribe with wrong auth token', async function (): Promise<void> {
				await withWrongAuthToken(manager1);
			});

			it('event should also be received by clients that are connected to other server processes', async function (): Promise<void> {
				await interProcessEventEmission(manager1, manager2, manager3);
			});

			it('unsubscribe without parameters', async function (): Promise<void> {
				await unsubscribeWithoutParameters(manager1);
			});

			it('event should not be received users of other tenants than me, because of the TestEventEmissionSendInterceptor on server side', async function (): Promise<void> {
				await eventEmissionInterceptor(manager1, manager2);
			});

			it('subscribe to event using the event name instead of the event constructor', async function (): Promise<void> {
				await subscribeEventByName(manager1);
			});
		});

		describe('events over websocket channel', function (): void {
			let manager1: NaniumConsumerBrowserWebsocket;
			let manager2: NaniumConsumerBrowserWebsocket;
			let manager3: NaniumConsumerBrowserWebsocket;

			beforeEach(async () => {
				session.token = '1234';
				session.tenant = 'Company1';
				await addHttpConsumer('http://localhost:8080', 1, 0);
				await addHttpConsumer('http://localhost:8081', 1, 0);
				manager1 = await addWebsocketConsumer('ws://localhost:8080', 0, 1);
				manager2 = await addWebsocketConsumer('ws://localhost:8081', 0, 1);
				manager3 = await addWebsocketConsumer('ws://localhost:8081', 0, 1); // for two different client-IDs connected with the same server
				Nanium.logger = new TestLogger(LogLevel.warn);
			});

			it('subscribe with wrong auth token', async function (): Promise<void> {
				await withWrongAuthToken(manager1);
			});

			it('event should also be received by clients that are connected to other server processes', async function (): Promise<void> {
				await interProcessEventEmission(manager1, manager2, manager3);
			});

			it('unsubscribe without parameters', async function (): Promise<void> {
				await unsubscribeWithoutParameters(manager1);
			});

			it('event should not be received users of other tenants than me, because of the TestEventEmissionSendInterceptor on server side', async function (): Promise<void> {
				await eventEmissionInterceptor(manager1, manager2);
			});

			it('subscribe to event using the event name instead of the event constructor', async function (): Promise<void> {
				await subscribeEventByName(manager1);
			});
		});
	});
});
