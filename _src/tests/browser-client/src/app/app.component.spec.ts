import { TestGetRequest, TestGetResponse, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { Nanium } from '../../../../core';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { AnonymousRequest } from '../../../services/test/anonymous.contract';
import { TestGetStreamedArrayBufferRequest } from '../../../services/test/getStreamedArrayBuffer.contract';
import { TestDto, TestQueryRequest } from '../../../services/test/query.contract';
import { TestNoIORequest } from '../../../services/test/noIO.contract';
import { TestGetBinaryRequest } from '../../../services/test/getBinary.contract';
import { TimeRequest } from '../../../services/test/time.contract';
import { NaniumProviderBrowser } from '../../../../managers/providers/browser';
import { StuffCreatedEvent } from '../../../events/test/stuffCreated.event';

function initNanium(baseUrl: string = 'http://localhost:8080'): void {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		}
	});
	Nanium.addManager(naniumConsumer).then();
}

describe('basic browser client tests', () => {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

	beforeEach(async () => {
		initNanium();
	});

	afterEach(async () => {
		await Nanium.shutdown();
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

		it('execute service with Binary response', async () => {
			const result = await new TestGetBinaryRequest().execute();
			expect(new TextDecoder().decode(result)).toBe('this is a text that will be send as binary data');
		});

		it('response as json stream', async () => {
			const dtoList: TestDto[] = [];
			let portions = 0;
			await new Promise((resolve: Function): void => {
				new TestQueryRequest({ input: 1 }, { token: '1234' }).stream().subscribe({
					next: (value: TestDto): void => {
						portions++;
						dtoList.push(value);
					},
					complete: (): void => resolve(),
					error: (err: Error) => {
						Nanium.logger.error(err.message, err.stack);
					}
				});
			});
			expect(portions).withContext('result array should be returned in multiple portions').toBe(999);
			expect(dtoList.length).withContext('length of result list should be correct').toBe(999);
			expect(dtoList[0].formatted()).toBe('1:1');
		});

		it('response as binary stream', async () => {
			const bufferPieces: ArrayBuffer[] = [];
			await new Promise((resolve: Function): void => {
				new TestGetStreamedArrayBufferRequest(undefined, { token: '1234' }).stream().subscribe({
					next: (value: ArrayBuffer): void => {
						bufferPieces.push(value);
					},
					complete: (): void => resolve(),
					error: (err: Error) => {
						Nanium.logger.error(err.message, err.stack);
					}
				});
			});
			expect(bufferPieces.length).withContext('length of result list should be correct').toBe(3);
			let fullLength: number = 0;
			bufferPieces.forEach(b => fullLength += b.byteLength);
			const fullBuffer: Uint8Array = new Uint8Array(fullLength);
			let currentIndex: number = 0;
			bufferPieces.forEach(b => {
				fullBuffer.set(new Uint8Array(b), currentIndex);
				currentIndex += b.byteLength;
			});
			const float32Array = new Float32Array(fullBuffer.buffer);
			expect(float32Array[0]).toBe(1);
			expect(float32Array[1]).toBe(2);
			expect(float32Array[4]).toBe(5);
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

		it('-->body = undefined\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(undefined, { token: '1234' }).execute();
			expect(result.body).toBe(undefined);
		});

		it('-->body = Date\n', async function (): Promise<void> {
			const result: ServiceResponseBase<Date> = await new TimeRequest(new Date(2000, 1, 1), { token: '1234' }).execute();
			expect(result.body.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
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
		},
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
		await StuffCreatedEvent.subscribe((evt: StuffCreatedEvent) => {
			expect(evt.aString).toBe(':-)');
		});
		new StuffCreatedEvent(42, ':-)', new Date(2021, 12, 6)).emit();
	});
});
