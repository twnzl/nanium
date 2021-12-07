import { ServiceExecutionContext } from '../../interfaces/serviceExecutionContext';
import { Nanium } from '../../core';
import { EventHandler } from '../../interfaces/eventHandler';

export class EventBase {

	emit(context?: ServiceExecutionContext): void {
		Nanium.emit(this, undefined, context);
	}

	static subscribe(handler: EventHandler): void {
		Nanium.subscribe(this, handler);
	}
}
