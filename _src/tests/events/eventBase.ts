import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';

export class EventBase {

	emit(context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static async subscribe(handler: EventHandler): Promise<EventSubscription> {
		return await Nanium.subscribe(this, handler);
	}

	static async unsubscribe(subscription: EventSubscription): Promise<void> {
		await Nanium.unsubscribe(subscription);
	}
}
