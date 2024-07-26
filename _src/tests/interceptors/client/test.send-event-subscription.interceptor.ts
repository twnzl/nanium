import { EventSubscription } from '../../../interfaces/eventSubscription';
import { TestSubscriptionData } from '../../events/eventBase';
import { session } from '../../session';
import { EventSubscriptionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor';
import { EventNameOrConstructor } from '../../../interfaces/eventConstructor';

export class TestEventSubscriptionSendInterceptor implements EventSubscriptionSendInterceptor<any, TestSubscriptionData> {

	async execute(eventNameOrConstructor: EventNameOrConstructor, subscription: EventSubscription<TestSubscriptionData>): Promise<void> {
		subscription.additionalData = {
			token: session.token,
			tenant: session.tenant
		};
	}
}
