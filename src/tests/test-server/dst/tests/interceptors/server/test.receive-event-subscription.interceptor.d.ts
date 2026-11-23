import { EventSubscription } from '../../../interfaces/eventSubscription.js';
import { EventBase, TestSubscriptionData } from '../../events/eventBase.js';
import { EventSubscriptionReceiveInterceptor } from '../../../interfaces/eventSubscriptionInterceptor.js';
export declare class TestEventSubscriptionReceiveInterceptor implements EventSubscriptionReceiveInterceptor<EventBase> {
    execute(subscription: EventSubscription<TestSubscriptionData>): Promise<void>;
}
