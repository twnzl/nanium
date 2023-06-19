import { TestExecutionContext } from '../services/testExecutionContext';
import { TestHelper } from '../testHelper';
import { StuffEvent } from './test/stuffEvent';
import { AsyncHelper } from '../../helper';
import {
	TestEventSubscriptionReceiveInterceptor
} from '../interceptors/server/test.receive-event-subscription.interceptor';
import { session } from '../session';

const executionContext: TestExecutionContext = new TestExecutionContext({ scope: 'private' });

describe('events \n', function (): void {

	describe('consumer (http) subscribes and provider emits the event\n with interceptor\n interceptor rejects subscription\n', () => {
		const sendEvent: StuffEvent = new StuffEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffEvent;

		it('--> subscribed handler should not have been executed\n', async () => {
			await TestHelper.shutdown();
			await TestHelper.initClientServerScenario('http', false);
			receivedEvent = undefined;
			TestHelper.provider.config.eventSubscriptionReceiveInterceptors = [TestEventSubscriptionReceiveInterceptor];
			session.tenant = 'WrongCompany';
			try {
				await StuffEvent.subscribe((e: StuffEvent) => {
					receivedEvent = e;
				}, TestHelper.consumer);
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
			expect(receivedEvent).toBeUndefined();
			await TestHelper.shutdown();
		});
	});
});
