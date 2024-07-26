import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ServiceManager } from '../../interfaces/serviceManager';
import { NaniumObject } from '../../objects';

export class EventBase<T = any> extends NaniumObject<T> {

	emit(context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static async subscribe(handler: EventHandler, managerOrData?: ServiceManager | any): Promise<EventSubscription> {
		return await Nanium.subscribe(this as any, handler, managerOrData);
	}

	static async unsubscribe(subscription?: EventSubscription): Promise<void> {
		await Nanium.unsubscribe(subscription, this['eventName']);
	}
}


export class TestSubscriptionData {
	constructor(
		public token: string,
		public tenant: string
	) {
	}
}
