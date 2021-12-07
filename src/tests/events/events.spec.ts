// const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });
// todo: what about authorization - not everybody can subscribe to every event and emitting an event must use executionContext, so that only clients with authorization and right mandator get the event
import { ServiceRequestContext } from '../services/serviceRequestContext';
import { TestHelper } from '../testHelper';
import { StuffCreatedEvent } from './test/stuffCreated.event';

const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

xdescribe('events \n', function (): void {

	beforeAll(async () => {
		await TestHelper.initClientServerScenario('http');
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('emit event via the consumer\n', () => {
		let event: StuffCreatedEvent;
		beforeEach(async () => {
			StuffCreatedEvent.subscribe((e: StuffCreatedEvent) => {
				event = e;
			});
			new StuffCreatedEvent(42, ':-)', new Date(2021, 12, 6)).emit(executionContext);
		});

		it('-->  \n', async () => {
			// expect(event.aNumber).toBe(42);
		});
	});
});
