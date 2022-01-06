import { Nanium } from '../core';
import { EventHandler } from './eventHandler';

export class EventSubscription<TData = any> {
	clientId: string;
	eventName?: string;
	handler?: EventHandler;
	additionalData?: TData;

	constructor(
		clientId: string,
		eventName: string,
		handler?: EventHandler,
		additionalData?: TData
	) {
		this.clientId = clientId;
		this.eventName = eventName;
		this.handler = handler;
		this.additionalData = additionalData;
	}

	async unsubscribe(): Promise<void> {
		await Nanium.unsubscribe(this);
	}
}
