import { EventBase } from './eventBase';
import { ServiceRequestContext } from '../services/serviceRequestContext';
import {
	EventEmissionSendInterceptor,
	EventSubscription,
	EventSubscriptionReceiveInterceptor,
	EventSubscriptionSendInterceptor
} from '../../interfaces/eventSubscriptionInterceptor';

export class TestEventSubscriptionReceiveInterceptor implements EventSubscriptionReceiveInterceptor<EventBase> {
	async execute(data: EventSubscription<TestSubscriptionData>): Promise<void> {
		if (data.additionalData?.token === '1234') {
			if (data.additionalData.tenant !== 'Company1') {
				throw new Error('unauthorized');
			}
		} else if (data.additionalData?.token === '5678') {
			if (data.additionalData.tenant !== 'Company2') {
				throw new Error('unauthorized');
			}
		} else {
			throw new Error('unauthorized');
		}
	}
}

export class TestEventEmissionSendInterceptor implements EventEmissionSendInterceptor<EventBase> {
	async execute(event: EventBase, context: ServiceRequestContext, subscription: EventSubscription<TestSubscriptionData>): Promise<boolean> {
		// basic permissions have been checked in DemoEventSubscriptionReceiveInterceptor.
		// So it is ensured that every existing subscriber has basic permissions for this event
		// but here e.g. you can make differences regarding the specific event

		return true;
	}
}

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


export class TestSubscriptionData {
	constructor(
		public token: string,
		public tenant: string
	) {
	}
}
