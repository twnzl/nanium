import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ExecutionContext } from '../../interfaces/executionContext';
import { ServiceManager } from '../../interfaces/serviceManager';
import { ConstructorType, NaniumObject } from '../../objects';

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
