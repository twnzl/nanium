import { Nanium } from '../core';
import { EventHandler } from './eventHandler';
import { ServiceManager } from './serviceManager';

export class EventSubscription<TData = any> {
	private static nextId: number = 0;

	id: number;
	clientId: string;
	manager: ServiceManager;
	eventName?: string;
	handler?: EventHandler;
	additionalData?: TData;

	constructor(
		clientId: string,
		eventName: string,
		handler?: EventHandler,
		additionalData?: TData
	) {
		this.id = EventSubscription.nextId++;
		this.clientId = clientId;
		this.eventName = eventName;
		this.handler = handler;
		this.additionalData = additionalData;
	}

	async unsubscribe(): Promise<void> {
		await Nanium.unsubscribe(this);
	}
}
