import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';

export class EventBase {

	emit(context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static async subscribe(handler: EventHandler): Promise<void> {
		await Nanium.subscribe(this, handler);
	}
}
