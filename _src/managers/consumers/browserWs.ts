import { Observable } from 'rxjs';
import { ServiceManager } from '../../interfaces/serviceManager';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { WebSocketClient } from './ws.core';
import { ConsumerBase } from './base';
import { WsMessage } from '../providers/channels/ws.types';

export interface NaniumConsumerBrowserWebsocketConfig extends ServiceConsumerConfig {
	// apiUrl?: string;
	apiEventUrl?: string;
	// onServerConnectionRestored?: () => void;
}

export class NaniumConsumerBrowserWebsocket extends ConsumerBase<NaniumConsumerBrowserWebsocketConfig> implements ServiceManager {
	private websocket?: WebSocketClient;

	constructor(config?: NaniumConsumerBrowserWebsocketConfig) {
		super(config);
		this.config.apiEventUrl = config.apiEventUrl ?? '';
	}

	async init(): Promise<void> {
		if (!this.config.apiEventUrl.startsWith('ws://') && !this.config.apiEventUrl.startsWith('wss://')) {
			this.config.apiEventUrl = (window.location.protocol === 'http:') ? 'ws://' : 'wss://' + window.location.host +
				(this.config.apiEventUrl.startsWith('/') ? '' : '/') + this.config.apiEventUrl;
		}
	}

	async terminate(): Promise<void> {
		this.websocket?.close();
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute<T>(_serviceName: string, _request: any, _executionContext?: ExecutionContext): Promise<any> {
		throw new Error('NotYetImplemented');
	}

	stream(_serviceName: string, _request: any): Observable<any> {
		throw new Error('NotYetImplemented');
		// todo: is obsolet, should be removed
	}

	private initWebSocket() {
		this.websocket = new WebSocketClient(this.config.apiEventUrl);
		this.websocket.on('open', async (): Promise<void> => {
			// if reconnected, resubscribe to events
			if (this.eventSubscriptions) {
				for (const subscription of Object.values(this.eventSubscriptions)) {
					this.sendEventSubscription(subscription.eventName, subscription.additionalData);
				}
			}
		});
		this.websocket.on('message', async event => {
			const message: WsMessage = this.config.serializer.deserialize(event.data);
			if (message.type === 'emit_event') {
				console.log(message);
				await super.receiveEventLocal(message.content.eventName, message.content.event);
			}
		});
		this.websocket.connect();
	}

	async subscribe(eventNameOrConstructor: EventNameOrConstructor, handler: EventHandler, _context?: ExecutionContext): Promise<EventSubscription> {
		if (!this.websocket) {
			this.initWebSocket();
		}
		await this.websocket.connected;
		const subscription: EventSubscription = await super.subscribeLocal(eventNameOrConstructor, handler);
		// if subscription for this event name has not already been sent to server - send it
		if (this.eventSubscriptions[subscription.eventName].eventHandlers.size === 1) {
			this.sendEventSubscription(subscription.eventName, subscription.additionalData);
		}
		return subscription;
	}

	private sendEventSubscription(eventName: string, additionalData: any) {
		const content: string | ArrayBuffer = this.config.serializer.serialize(<WsMessage<EventSubscription>>{
			type: 'subscribe_event',
			content: {
				clientId: this.id,
				eventName: eventName,
				additionalData: additionalData
			}
		});
		this.websocket.send(content);
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		await super.unsubscribeLocal(subscription, eventName);
		await this.websocket.connected;
		// no mor handlers for this event registered - so unsubscribe on server
		if (!this.eventSubscriptions[subscription.eventName]?.eventHandlers?.size) {
			const content: string | ArrayBuffer = this.config.serializer.serialize(<WsMessage<EventSubscription>>{
				type: 'unsubscribe_event',
				content: {
					clientId: this.id,
					eventName: eventName,
					additionalData: subscription.additionalData,
					id: subscription.id
				}
			});
			this.websocket.send(content);
		}
	}

	emit(eventName: string, event: any, context: ExecutionContext): any {
		throw new Error('NotImplemented');
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('NotImplemented');
	}
}
