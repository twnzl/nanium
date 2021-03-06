import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ServiceManager } from '../../interfaces/serviceManager';

export class EventBase {

	emit(context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static async subscribe(handler: EventHandler, context?: ServiceManager | any): Promise<EventSubscription> {
		return await Nanium.subscribe(this, handler, context);
	}

	static async unsubscribe(subscription: EventSubscription): Promise<void> {
		await Nanium.unsubscribe(subscription);
	}
}
