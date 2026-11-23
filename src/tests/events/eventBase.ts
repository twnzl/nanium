import { Nanium } from '../../core.js';
import { EventHandler } from '../../interfaces/eventHandler.js';
import { EventSubscription } from '../../interfaces/eventSubscription.js';
import { ExecutionContext } from '../../interfaces/executionContext.js';
import { ServiceManager } from '../../interfaces/serviceManager.js';
import { ConstructorType, NaniumObject } from '../../objects.js';

export class EventBase<T = any> extends NaniumObject<T> {

	emit(this: T, context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static async subscribe<T extends EventBase<T>>(this: ConstructorType<T>, handler: EventHandler<T>, context?: ExecutionContext, manager?: ServiceManager): Promise<EventSubscription> {
		return await Nanium.subscribe(this as any, handler, context, manager);
	}

	static async unsubscribe(subscriptionOrManager?: EventSubscription | ServiceManager): Promise<void> {
		await Nanium.unsubscribe(subscriptionOrManager, this['eventName']);
	}
}


export class TestSubscriptionData {
	constructor(
		public token: string,
		public tenant: string
	) {
	}
}
