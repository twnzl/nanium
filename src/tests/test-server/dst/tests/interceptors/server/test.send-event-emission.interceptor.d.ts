import { EventSubscription } from '../../../interfaces/eventSubscription.js';
import { EventEmissionSendInterceptor } from '../../../interfaces/eventSubscriptionInterceptor.js';
import { EventBase, TestSubscriptionData } from '../../events/eventBase.js';
import { TestExecutionContext } from '../../services/testExecutionContext.js';
export declare class TestEventEmissionSendInterceptor implements EventEmissionSendInterceptor<EventBase> {
    execute(event: EventBase, context: TestExecutionContext, subscription: EventSubscription<TestSubscriptionData, TestExecutionContext>): Promise<boolean>;
}
