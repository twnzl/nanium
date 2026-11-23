import { TestExecutionContext } from '../../services/testExecutionContext.js';
export class TestEventSubscriptionReceiveInterceptor {
    async execute(subscription) {
        if (subscription.additionalData?.token === '1234' || subscription.additionalData?.token === '4321') {
            if (subscription.additionalData.tenant !== 'Company1') {
                throw new Error('unauthorized');
            }
        }
        else if (subscription.additionalData?.token === '5678') {
            if (subscription.additionalData.tenant !== 'Company2') {
                throw new Error('unauthorized');
            }
        }
        else {
            throw new Error('unauthorized');
        }
        subscription.context = new TestExecutionContext({
            user: 'user ' + subscription.additionalData?.token,
            tenant: subscription.additionalData.tenant,
        });
    }
}
//# sourceMappingURL=test.receive-event-subscription.interceptor.js.map