import { Nanium } from '../core';
import { EventHandler } from './eventHandler';
import { Type } from '../objects';

export class EventSubscription<TData = any, TContext = any> {
	private static nextId: number = 0;

	@Type(Number) id: number;
	@Type(String) clientId: string;
	@Type(Object) context: TContext;
	@Type(String) eventName?: string;
	@Type('TData') additionalData?: TData;
	@Type(String) channelId?: string;

	handler?: EventHandler;

	constructor(
		clientId: string,
		eventName: string,
		handler?: EventHandler,
		additionalData?: TData,
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
