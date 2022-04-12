import { ServiceRequestContext } from '../services/serviceRequestContext';
import { TestHelper } from '../testHelper';
import { StuffCreatedEvent } from './test/stuffCreated.event';
import { AsyncHelper } from '../../helper';
import { TestEventSubscriptionReceiveInterceptor, TestEventSubscriptionSendInterceptor } from './test.interceptor';


const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

describe('events \n', function (): void {

	describe('consumer (http) subscribes and provider emits the event\n with interceptor\n interceptor rejects subscription\n', () => {
		const sendEvent: StuffCreatedEvent = new StuffCreatedEvent(42, ':-)', new Date(2021, 12, 6));
		let receivedEvent: StuffCreatedEvent;

		it('--> subscribed handler should not have been executed\n', async () => {
			await TestHelper.shutdown();
			await TestHelper.initClientServerScenario('http', false);
			receivedEvent = undefined;
			TestHelper.provider.config.eventSubscriptionReceiveInterceptors = [TestEventSubscriptionReceiveInterceptor];
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
			expect(receivedEvent).toBeUndefined();
			await TestHelper.shutdown();
		});
	});
});
