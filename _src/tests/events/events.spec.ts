// const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });
// todo: events: what about authorization - not everybody can subscribe to every event and emitting an event must use executionContext, so that only clients with authorization and right mandator get the event
import { ServiceRequestContext } from '../services/serviceRequestContext';
import { TestHelper } from '../testHelper';
import { StuffCreatedEvent } from './test/stuffCreated.event';
import { AsyncHelper } from '../../helper';

const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

describe('events \n', function (): void {

	afterEach(async () => {
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
			await sendEvent.emit(executionContext);
		});

		it('--> subscribed handler should habe been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
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
			await StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
				receivedEvent = e;
			});
			await sendEvent.emit(executionContext);
			await AsyncHelper.waitUntil(() => receivedEvent !== undefined);
		});

		it('--> subscribed handler should habe been executed and the event must be received as real event instance with correct property values and value types \n', async () => {
			expect(receivedEvent.aNumber).toBe(sendEvent.aNumber);
			expect(receivedEvent.aString).toBe(sendEvent.aString);
			expect(receivedEvent.aDate.toISOString()).toBe(sendEvent.aDate.toISOString()); // plainToClass not yet implemented für events
		});
	});

});
