import { ServiceRequestContext } from '../services/serviceRequestContext';
import { TestHelper } from '../testHelper';
import { StuffCreatedEvent } from './test/stuffCreated.event';
import { AsyncHelper } from '../../helper';
import { TestEventSubscriptionReceiveInterceptor, TestEventSubscriptionSendInterceptor } from './test.interceptor';


const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

describe('events \n', function (): void {

	afterEach(async () => {
		await StuffCreatedEvent.unsubscribe();
		await TestHelper.shutdown();
	});

	describe('same provider subscribes and emits the event \n', () => {
		const sendEvent: StuffCreatedEvent = new StuffCreatedEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffCreatedEvent;
		beforeEach(async () => {
			await TestHelper.initClientServerScenario('http', true);
			await StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
				receivedEvent = e;
			});
			sendEvent.emit(executionContext);
		});

		it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
			expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
			expect(receivedEvent.aString).toBe(sendEvent.aString);
			expect(receivedEvent.aDate).toBe(sendEvent.aDate);
		});
	});

	describe('consumer (http) subscribes and provider emits the event \n', () => {
		const sendEvent: StuffCreatedEvent = new StuffCreatedEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffCreatedEvent;

		beforeEach(async () => {
			await TestHelper.initClientServerScenario('http', false);
			receivedEvent = undefined;
		});

		describe('with no interceptor \n', () => {
			beforeEach(async () => {
				await StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
					receivedEvent = e;
				});
				sendEvent.emit(executionContext);
				await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
			});

			it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
				expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
				expect(receivedEvent.aString).toBe(sendEvent.aString);
				expect(receivedEvent.aDate.toISOString()).toBe(sendEvent.aDate.toISOString()); // plainToClass not yet implemented für events
			});
		});

		describe('with interceptor \n', () => {
			beforeEach(async () => {
				TestHelper.provider.config.eventSubscriptionReceiveInterceptors = [TestEventSubscriptionReceiveInterceptor];
			});

			describe('interceptor accepts subscription \n', function (): void {
				beforeEach(async function (): Promise<void> {
					TestEventSubscriptionSendInterceptor.tenant = 'Company1';
					await StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
						receivedEvent = e;
					});
					sendEvent.emit(executionContext);
					await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
				});

				it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
					expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
					expect(receivedEvent.aString).toBe(sendEvent.aString);
					expect(receivedEvent.aDate.toISOString()).toBe(sendEvent.aDate.toISOString()); // plainToClass not yet implemented für events
				});
			});

			describe('interceptor rejects subscription \n', function (): void {
				beforeEach(async function (): Promise<void> {
					TestEventSubscriptionSendInterceptor.tenant = 'WrongCompany';
					try {
						await StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
							receivedEvent = e;
						});
					} catch (e) {
						expect(e?.message).toBe('unauthorized');
					}
					try {
						receivedEvent = undefined;
						sendEvent.emit(executionContext);
						await AsyncHelper.waitUntil(() => receivedEvent !== undefined, 1000, 1000);
					} catch (e) {
						expect(e?.message).toBe('timeout');
					}
				});

				it('--> subscribed handler should not have been executed\n', async () => {
					expect(receivedEvent).toBeUndefined();
				});
			});
		});
	});
});
