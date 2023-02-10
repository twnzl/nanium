import { EventSubscriptionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { TestSubscriptionData } from '../../events/eventBase';

export class TestEventSubscriptionSendInterceptor implements EventSubscriptionSendInterceptor<any, TestSubscriptionData> {
	static token: string = '1234';
	static tenant: string = 'Company1';

	async execute(eventClass: new (data?: any) => any, subscription: EventSubscription<TestSubscriptionData>): Promise<void> {
		subscription.additionalData = {
			token: TestEventSubscriptionSendInterceptor.token,
			tenant: TestEventSubscriptionSendInterceptor.tenant
		};
	}
}
