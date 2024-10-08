import { TestGetRequest, TestGetResponse, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { Nanium } from '../../../../core';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { NaniumProviderBrowser } from '../../../../managers/providers/browser';
import { StuffEvent } from '../../../events/test/stuffEvent';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import {
	TestEventSubscriptionSendInterceptor
} from '../../../interceptors/client/test.send-event-subscription.interceptor';
import { EventSubscription } from '../../../../interfaces/eventSubscription';
import { AsyncHelper } from '../../../../helper';
import { session } from '../../../session';
import { Stuff2Event } from '../../../events/test/stuff2Event';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { TimeRequest } from '../../../services/test/time.contract';
import { TestDto } from '../../../services/test/query.contract';
import { TestGetNaniumBufferRequest } from '../../../services/test/getNaniumBuffer.contract';
import { TestNoIORequest } from '../../../services/test/noIO.contract';
import { TestGetBinaryRequest } from '../../../services/test/getBinary.contract';
import { AnonymousRequest } from '../../../services/test/anonymous.contract';
import { TestStreamedQueryRequest } from '../../../services/test/streamedQuery.contract';
import { NaniumStream } from '../../../../interfaces/naniumStream';
import { TestStreamedBinaryRequest } from '../../../services/test/streamedBinary.contract';

function initNanium(baseUrl: string = 'http://localhost:8080', responsibility: number = 1): void {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
		isResponsible: () => Promise.resolve(responsibility),
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		}
	});
	Nanium.addManager(naniumConsumer).then();
}

describe('basic browser client tests', () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

	beforeEach(async () => {
		session.token = '1234';
		session.tenant = 'Company1';
		initNanium();
	});

	afterEach(async () => {
		await Nanium.shutdown();
		session.token = '1234';
		session.tenant = 'Company1';
	});

	describe('execute request via the consumer \n', function (): void {

		it('normal successful execution', async () => {
			let response: ServiceResponseBase<TestGetResponseBody>;
			response = await new TestGetRequest({ input1: 'hello world' }).execute();
			expect(response?.body?.output1).withContext('output1 should be correct').toBe('hello world :-)');
			expect(response?.body?.output2).withContext('output2 should be correct').toBe(2);
		});

		it('execute and skip interceptor', async function (): Promise<void> {
			const anonymousRequest: AnonymousRequest = new AnonymousRequest(undefined, {});
			const anonymousResponse: ServiceResponseBase<string> = await anonymousRequest.execute();
			expect(anonymousResponse.body).withContext('output should be correct').toBe(':-)');
		});

		it('test response interceptor\n', async function (): Promise<void> {
			let response: ServiceResponseBase<TestGetResponseBody>;
			TestClientResponseInterceptor.responseCnt = 0;
			response = await new TestGetRequest({ input1: '111' }).execute();
			expect(response?.body?.output1).withContext('output1 should be the original result from the service executor').toBe('111 :-)');
			expect(TestClientResponseInterceptor.responseCnt).toBe(1);
			response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnDifferentResponse' }).execute();
			expect(response?.body?.output1).withContext('output1 should be the result that the interceptor returned').toBe('ResultFromInterceptor');
			expect(TestClientResponseInterceptor.responseCnt).toBe(2);
			response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnNull' }).execute();
			expect(response).withContext('response should be null because interceptor returned null').toBeNull();
			expect(TestClientResponseInterceptor.responseCnt).toBe(3);
			response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnUndefined' }).execute();
			expect(response.body.output1).withContext('output1 should be the original result from the service executor, because interceptor returned undefined').toBe('TestResponseInterceptor:ReturnUndefined :-)');
			expect(TestClientResponseInterceptor.responseCnt).toBe(4);
			response = await new TestGetRequest({ input1: 'TestResponseInterceptor:ReturnSameResponseInstance' }).execute();
			expect(response.body.output1).withContext('output1 should be the original result from the service executor, because interceptor returned original response instance').toBe('TestResponseInterceptor:ReturnSameResponseInstance :-)');
			expect(TestClientResponseInterceptor.responseCnt).toBe(5);
		});

		it('execute with error result (handling by errorHandle)', async () => {
			try {
				await new TestGetRequest({ input1: 'hello world' }, { token: 'wrong' }).execute();
				expect(false).withContext('an exception should be thrown').toBeTruthy();
			} catch (e) {
				expect(e.handleError).withContext('the errorHandler function should have handled the error').toBeDefined();
				expect(e.handleError.message).toBe('unauthorized');
			}
		});

		it('execute service with void body and void response', async () => {
			await new TestNoIORequest().execute();
			expect(true).toBeTruthy();
		});

		it('execute service with Binary (ArrayBuffer) response', async () => {
			const result = await new TestGetBinaryRequest().execute();
			expect(await result.asString()).toBe('this is a text that will be send as binary data');
		});

		it('execute service with Binary (NaniumBuffer) response', async () => {
			const result: NaniumBuffer = await new TestGetNaniumBufferRequest().execute();
			expect(await result.asString()).toBe('this is a text that will be send as NaniumBuffer');
		});

		it('response as json stream', async () => {
			const dtoList: TestDto[] = [];
			let portions = 0;
			await new Promise(async (resolve: Function): Promise<void> => {
				const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
					{ amount: 6, msGapTime: 100 }, { token: '1234' }).execute();
				response.onData((value: TestDto): void => {
					portions++;
					dtoList.push(value);
				});
				response.onEnd(() => {
					resolve();
				});
				response.onError((err: Error) => {
					Nanium.logger.error(err.message, err.stack);
				});
			});
			expect(portions).withContext('result array should be returned in multiple portions').toBe(6);
			expect(dtoList.length).withContext('length of result list should be correct').toBe(6);
			expect(dtoList[0].formatted()).toBe('1:1');
			expect(dtoList[2].formatted()).toBe('3:3');
		});

		it('response as json stream toPromise()', async () => {
			const responseStream: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
				{ amount: 6, msGapTime: 0 }, { token: '1234' }).execute();
			const dtoList: TestDto[] = await responseStream.toPromise();
			expect(dtoList.length).withContext('length of result list should be correct').toBe(6);
			expect(dtoList[0].formatted()).toBe('1:1');
			expect(dtoList[2].formatted()).toBe('3:3');
		});

		it('response as binary stream', async () => {
			const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();
			const result: NaniumBuffer = new NaniumBuffer();
			await new Promise((resolve: Function) => {
				stream.onData(async (chunk) => {
					result.write(chunk);
				}).onEnd(async () => {
					expect(await result.asString()).toBe('1.2.3.');
					resolve();
				});
			});
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
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer(new TextEncoder().encode('123')),
				buffer2: new NaniumBuffer(new TextEncoder().encode('456'))
			});
			const response = await request.execute();
			expect(response.id).toBe('1');
			expect(response.text1).toBe('123*');
			expect(response.text2).toBe('456*');
		});

		it('NaniumBuffers in request but one is undefined \n', async function (): Promise<void> {
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer(new TextEncoder().encode('123')),
				buffer2: undefined
			});
			const response = await request.execute();
			expect(response.id).toBe('1');
			expect(response.text1).toBe('123*');
			expect(response.text2).toBeUndefined('');
		});
	});

	describe('NaniumBuffer \n', function (): void {
		const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
		const blob = new Blob(['def']);
		const file: File = new File([new Blob(['fff'])], 'test.bin');
		const uint8Array: ArrayBuffer = new TextEncoder().encode('jkl');

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

describe('test browser client with wrong api url', () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

	beforeEach(async () => {
		initNanium('https://not.available');
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
		initNanium();
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
	beforeEach(async () => {
		session.token = '1234';
		session.tenant = 'Company1';
		initNanium('http://localhost:8080');
		initNanium('http://localhost:8081');
	});

	afterEach(async () => {
		await Nanium.shutdown();
	});

	it('subscribe with wrong auth token', async function (): Promise<void> {
		const manager = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		let subscription;
		try {
			session.token = 'wrong!!';
			// should call the client interceptor that adds credentials, but they are wrong
			subscription = await StuffEvent.subscribe(() => {
			}, manager);
			expect(true).withContext('an exception should have been thrown').toBeFalse();
		} catch (e) {
			expect(e).toBe('unauthorized');
		} finally {
			subscription?.unsubscribe();
			session.token = '1234'; // reset right credentials
		}
	});

	it('event should also be received by clients that are connected to other server processes', async function (): Promise<void> {
		let subscription1: EventSubscription;
		let subscription2: EventSubscription;
		session.token = '1234'; // reset right credentials
		const manager1 = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		const manager2 = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8081'));
		let event1: StuffEvent;
		let event2: StuffEvent;
		await new Promise<void>(async (resolve: Function) => {
			subscription1 = await StuffEvent.subscribe((event) => {
				event1 = event;
				if (event2) {
					resolve();
				}
			}, manager1);
			subscription2 = await StuffEvent.subscribe((event) => {
				event2 = event;
				if (event1) {
					resolve();
				}
			}, manager2);
			await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		});
		await subscription1.unsubscribe();
		await subscription2.unsubscribe();
		expect(event1.aNumber).withContext('aNumber should be correct').toBe(9);
		expect(event1.aString).withContext('aString should be correct').toBe('10');
		expect(event1.aDate?.toISOString()).withContext('aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
		expect(event2.aNumber).withContext('aNumber should be correct').toBe(9);
		expect(event2.aString).withContext('aString should be correct').toBe('10');
		expect(event2.aDate?.toISOString()).withContext('aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
	});

	it('unsubscribe without parameters', async function (): Promise<void> {
		session.token = '1234'; // reset right credentials
		let event1: StuffEvent;
		let event2: Stuff2Event;
		await StuffEvent.subscribe((event) => event1 = event);
		await Stuff2Event.subscribe((event) => event2 = event);
		await Stuff2Event.unsubscribe();
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		await AsyncHelper.pause(1000);
		await StuffEvent.unsubscribe();
		expect(event1.aNumber).withContext('aNumber should be correct').toBe(9);
		expect(event1.aString).withContext('aString should be correct').toBe('10');
		expect(event1.aDate?.toISOString()).withContext('aDate should be correct').toBe(new Date(2011, 11, 11).toISOString());
		expect(event2).toBeUndefined();
	});

	it('event should not be received users of other tenants than me, because of the TestEventEmissionSendInterceptor on server side', async function (): Promise<void> {
		let subscription1: EventSubscription;
		let subscription2: EventSubscription;
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		const manager1 = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		const manager2 = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8081'));
		let event1: StuffEvent;
		let event2: StuffEvent;
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		subscription1 = await StuffEvent.subscribe((event) => {
			event1 = event;
		}, manager1);
		session.token = '5678'; // other tenant
		session.tenant = 'Company2';
		subscription2 = await StuffEvent.subscribe((event) => {
			event2 = event;
		}, manager2);
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
	});

	it('subscribe to event using the event name instead of the event constructor', async function (): Promise<void> {
		// session.token = '1234'; // reset right credentials
		const manager1 = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		const subscription1 = await Nanium.subscribe(StuffEvent.eventName, async (event) => {
			await subscription1.unsubscribe();
			expect(event.aNumber).withContext('aNumber should be correct').toBe(9);
			expect(event.aString).withContext('aString should be correct').toBe('10');
			expect(event.aDate as any).withContext('aDate is an ISOString because subscription without event constructor does not support real types').toBe(new Date(2011, 11, 11).toISOString());
		}, manager1);
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffEvent
	});
});
