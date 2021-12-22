import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';

export class EventBase {

	emit(context?: ExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static subscribe(handler: EventHandler): void {
		Nanium.subscribe(this, handler);
	}
}
