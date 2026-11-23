import { EventSubscription } from '../../../interfaces/eventSubscription.js';
import { TestSubscriptionData } from '../../events/eventBase.js';
import { session } from '../../session.js';
import { EventSubscriptionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor.js';
import { EventNameOrConstructor } from '../../../interfaces/eventConstructor.js';

export class TestEventSubscriptionSendInterceptor implements EventSubscriptionSendInterceptor<any, TestSubscriptionData> {

	async execute(eventNameOrConstructor: EventNameOrConstructor, subscription: EventSubscription<TestSubscriptionData>): Promise<void> {
		subscription.additionalData = {
			token: session.token,
			tenant: session.tenant
		};
	}
}
