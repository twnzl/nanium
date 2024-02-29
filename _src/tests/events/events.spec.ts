import { TestExecutionContext } from '../services/testExecutionContext';
import { TestHelper } from '../testHelper';
import { StuffEvent } from './test/stuffEvent';
import { AsyncHelper } from '../../helper';
import { EventSubscription } from '../../interfaces/eventSubscription';
import {
	TestEventSubscriptionReceiveInterceptor
} from '../interceptors/server/test.receive-event-subscription.interceptor';
import { Stuff2Event } from './test/stuff2Event';
import { session } from '../session';

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
		});

		afterEach(async () => {
			await TestHelper.shutdown();
		});

		it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
			sendEvent.emit(executionContext);
			expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
			expect(receivedEvent.aString).toBe(sendEvent.aString);
			expect(receivedEvent.aDate).toBe(sendEvent.aDate);
			await stuffCreatedEventSubscription?.unsubscribe();
		});

		it('--> unsubscribe all handlers of an event type \n', async () => {
			let receivedEvent2: Stuff2Event;
			await Stuff2Event.subscribe((e: StuffEvent) => {
				receivedEvent2 = e;
			});
			new Stuff2Event().emit(executionContext);
			expect(receivedEvent2).toBeDefined();
			receivedEvent2 = undefined;
			await Stuff2Event.unsubscribe();
			new Stuff2Event().emit(executionContext);
			expect(receivedEvent2).toBeUndefined();
			sendEvent.emit(executionContext);
			expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
			expect(receivedEvent.aString).toBe(sendEvent.aString);
			expect(receivedEvent.aDate).toBe(sendEvent.aDate);
			await StuffEvent.unsubscribe();
			await stuffCreatedEventSubscription?.unsubscribe();
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
			await StuffEvent.unsubscribe(/*stuffCreatedEventSubscription*/);
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
					session.tenant = 'Company1';
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
