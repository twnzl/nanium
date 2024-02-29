import { EventEmissionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor';
import { EventBase, TestSubscriptionData } from '../../events/eventBase';
import { TestExecutionContext } from '../../services/testExecutionContext';
import { EventSubscription } from '../../../interfaces/eventSubscription';

export class TestEventEmissionSendInterceptor implements EventEmissionSendInterceptor<EventBase> {
	async execute(event: EventBase, context: TestExecutionContext, subscription: EventSubscription<TestSubscriptionData, TestExecutionContext>): Promise<boolean> {
		// this ensures, that generally all events are only sent to clients of the same tenant
		return context.tenant === subscription.context.tenant;
	}
}
