import { TestExecutionContext } from '../services/testExecutionContext';
import { TestHelper } from '../testHelper';
import { StuffEvent } from './test/stuffEvent';
import { AsyncHelper } from '../../helper';
import { EventSubscription } from '../../interfaces/eventSubscription';
import {
	TestEventSubscriptionReceiveInterceptor
} from '../interceptors/server/test.receive-event-subscription.interceptor';
import { TestEventSubscriptionSendInterceptor } from '../interceptors/client/test.send-event-subscription.interceptor';

const executionContext: TestExecutionContext = new TestExecutionContext({ scope: 'private' });
let stuffCreatedEventSubscription: EventSubscription = null;

describe('events \n', function (): void {

	describe('same provider subscribes and emits the event \n', () => {
		const sendEvent: StuffEvent = new StuffEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffEvent;
		beforeEach(async () => {
			await TestHelper.initClientServerScenario('http', true);
			stuffCreatedEventSubscription = await StuffEvent.subscribe((e: StuffEvent) => {
				receivedEvent = e;
			});
			sendEvent.emit(executionContext);
		});

		afterEach(async () => {
			await stuffCreatedEventSubscription?.unsubscribe();
			await TestHelper.shutdown();
		});

		it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
			expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
			expect(receivedEvent.aString).toBe(sendEvent.aString);
			expect(receivedEvent.aDate).toBe(sendEvent.aDate);
		});
	});

	describe('consumer (http) subscribes and provider emits the event \n', () => {
		const sendEvent: StuffEvent = new StuffEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffEvent;

		beforeEach(async () => {
			await TestHelper.initClientServerScenario('http', false);
			receivedEvent = undefined;
		});

		afterEach(async () => {
			await StuffEvent.unsubscribe(stuffCreatedEventSubscription);
			await TestHelper.shutdown();
		});

		describe('with no interceptor \n', () => {
			beforeEach(async () => {
				await StuffEvent.subscribe((e: StuffEvent) => {
					receivedEvent = e;
				});
				sendEvent.emit(executionContext);
				await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
			});

			it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
				expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
				expect(receivedEvent.aString).toBe(sendEvent.aString);
				expect(receivedEvent.aDate.toISOString()).toBe(sendEvent.aDate.toISOString());
			});
		});

		describe('with interceptor \n', () => {
			beforeEach(async () => {
				TestHelper.provider.config.eventSubscriptionReceiveInterceptors = [TestEventSubscriptionReceiveInterceptor];
			});

			describe('interceptor accepts subscription \n', function (): void {
				beforeEach(async function (): Promise<void> {
					TestEventSubscriptionSendInterceptor.tenant = 'Company1';
					await StuffEvent.subscribe((e: StuffEvent) => {
						receivedEvent = e;
					});
					sendEvent.emit(executionContext);
					await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
				});

				it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
					expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
					expect(receivedEvent.aString).toBe(sendEvent.aString);
					expect(receivedEvent.aDate.toISOString()).toBe(sendEvent.aDate.toISOString());
				});
			});
		});
	});
});
