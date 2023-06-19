import { EventSubscriptionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { TestSubscriptionData } from '../../events/eventBase';
import { session } from '../../session';

export class TestEventSubscriptionSendInterceptor implements EventSubscriptionSendInterceptor<any, TestSubscriptionData> {

	async execute(eventClass: new (data?: any) => any, subscription: EventSubscription<TestSubscriptionData>): Promise<void> {
		subscription.additionalData = {
			token: session.token,
			tenant: session.tenant
		};
	}
}
