import exp = require('constants');
import { EventSubscription } from '../../interfaces/eventSubscription';
import { TestExecutionContext } from '../services/testExecutionContext';
import { TestHelper } from '../testHelper';
import { Stuff2Event } from './test/stuff2Event';
import { StuffEvent } from './test/stuffEvent';

const executionContext: TestExecutionContext = new TestExecutionContext({ scope: 'private' });

describe('events \n', function (): void {

	describe('same provider subscribes and emits the event \n', () => {
		const sendEvent: StuffEvent = new StuffEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffEvent;
		let stuffCreatedEventSubscription: EventSubscription = null;

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

	// todo: redesign node-to-node tests to use separate process for the server and do real http communication
	// describe('consumer (http) subscribes and provider emits the event \n', () => {
	// 	// const sendEvent: StuffEvent = new StuffEvent(42, ':-)', new Date(2021, 12, 6));
	// 	let receivedEvent: StuffEvent;

	// 	beforeAll(async () => {
	// 		await TestHelper.initClientServerScenario('http', false);
	// 		receivedEvent = undefined;
	// 	});

	// 	afterAll(async () => {
	// 		await TestHelper.shutdown();
	// 	});

	// 	describe('with no interceptor \n', () => {
	// 		it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
	// 			await StuffEvent.subscribe((e: StuffEvent) => {
	// 				receivedEvent = e;
	// 			});
	// 			const result = await new TestGetRequest({ cnt: 42, input1: ':-)' }).execute(); // emits the event on the server
	// 			expect(result).toBeDefined();
	// 			await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
	// 			expect(receivedEvent.aNumber).toBe(42);
	// 			expect(receivedEvent.aString).toBe(':-)');
	// 			expect(receivedEvent.aDate.toISOString()).toBe(new Date(2011, 10, 10));
	// 		});
	// 	});

	// 	describe('with interceptor \n', () => {
	// 		beforeEach(async () => {
	// 			TestHelper.provider.config.eventSubscriptionReceiveInterceptors = [TestEventSubscriptionReceiveInterceptor];
	// 		});

	// 		describe('interceptor accepts subscription \n', function (): void {
	// 			it('--> subscribed handler should have been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
	// 				session.tenant = 'Company1';
	// 				await StuffEvent.subscribe((e: StuffEvent) => {
	// 					receivedEvent = e;
	// 				});
	// 				await new TestGetRequest({ cnt: 43, input1: ':-)' }).execute(); // emits the event on the server
	// 				await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
	// 				expect(receivedEvent.aNumber).toBe(43);
	// 				expect(receivedEvent.aString).toBe(':-)');
	// 				expect(receivedEvent.aDate.toISOString()).toBe(new Date(2011, 10, 10));
	// 			});
	// 		});
	// 	});
	// });
});
