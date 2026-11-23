import { Nanium } from '../../core.js';
import { NaniumObject } from '../../objects.js';
export class EventBase extends NaniumObject {
    emit(context) {
        Nanium.emit(this, undefined, context);
    }
    static async subscribe(handler, context, manager) {
        return await Nanium.subscribe(this, handler, context, manager);
    }
    static async unsubscribe(subscriptionOrManager) {
        await Nanium.unsubscribe(subscriptionOrManager, this['eventName']);
    }
}
export class TestSubscriptionData {
    constructor(token, tenant) {
        this.token = token;
        this.tenant = tenant;
    }
}
//# sourceMappingURL=eventBase.js.map