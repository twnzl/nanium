import { ServiceManager } from '../../interfaces/serviceManager';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { WebSocketClient } from './ws.core';
import { ConsumerBase } from './base';
import {
	EmitEventMessageContent,
	SubscribeEventmessageContent,
	WsMessage,
	WsServiceRequestMessage,
	WsServiceResponseMessage
} from '../providers/channels/ws.types';
import { Nanium } from '../../core';
import { NaniumObject, responseTypeSymbol } from '../../objects';

export interface NaniumConsumerBrowserWebsocketConfig extends ServiceConsumerConfig {
	// apiUrl?: string;
	apiEventUrl?: string;
	// onServerConnectionRestored?: () => void;
}

export class NaniumConsumerBrowserWebsocket extends ConsumerBase<NaniumConsumerBrowserWebsocketConfig> implements ServiceManager {
	private websocket?: WebSocketClient;
	private pendingEventSubscriptions: Map<string, { resolve: Function, reject: Function }> = new Map();
	private pendingEventUnSubscriptions: Map<string, { resolve: Function, reject: Function }> = new Map();
	private pendingRequests: Map<string, { request: any, resolve: Function, reject: Function }> = new Map();

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

	async execute<T>(serviceName: string, request: any, executionContext?: ExecutionContext): Promise<any> {
		return new Promise<void>(async (resolve: Function, reject: Function) => {
			await this.initWebSocket();

			// execute request interceptors
			if (this.config.requestInterceptors?.length) {
				let result: any;
				for (const interceptor of this.config.requestInterceptors) {
					result = await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, executionContext ?? {});
					// if an interceptor returns an object other than the request it is a result and the execution shall be
					// finished with this result
					if (result !== undefined && result !== request) {
						resolve(result);
						return;
					}
				}
			}

			const msg: WsMessage<WsServiceRequestMessage> = {
				type: 'service_request',
				content: {
					id: self.crypto.randomUUID(),
					serviceName,
					request,
				}
			};
			this.pendingRequests.set(msg.content.id, { request, resolve, reject });
			this.websocket.send(this.config.serializer.serialize(msg));
		});
	}

	private async initWebSocket() {
		if (this.websocket) {
			return;
		}
		this.websocket = new WebSocketClient(this.config.apiEventUrl);
		this.websocket.on('open', async (): Promise<void> => {
			// if reconnected, resubscribe to events
			if (this.eventSubscriptions) {
				await Promise.all(
					Object.values(this.eventSubscriptions)
						.map(s => this.sendEventSubscription(s.eventName, s.additionalData))
				);
			}
		});
		this.websocket.on('message', async event => {
			const rawMessage: WsMessage = this.config.serializer.deserialize(event.data);
			if (rawMessage.type === 'emit_event') {
				const message = new WsMessage<EmitEventMessageContent>(rawMessage, { 'TContent': EmitEventMessageContent });
				await super.receiveEventLocal(message.content.eventName, message.content.event);
			} else if (rawMessage.type === 'subscription_result') {
				const message = new WsMessage<SubscribeEventmessageContent>(rawMessage, { 'TContent': SubscribeEventmessageContent });
				const promiseFunctions = this.pendingEventSubscriptions.get(message.content.eventName);
				this.pendingEventSubscriptions.delete(message.content.eventName);
				if (message.content.error) {
					promiseFunctions.reject(message.content.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'unsubscription_result') {
				const message = new WsMessage<SubscribeEventmessageContent>(rawMessage, { 'TContent': SubscribeEventmessageContent });
				const promiseFunctions = this.pendingEventUnSubscriptions.get(message.content.eventName);
				this.pendingEventUnSubscriptions.delete(message.content.eventName);
				if (message.content.error) {
					promiseFunctions.reject(message.content.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'service_response') {
				const message = new WsMessage<WsServiceResponseMessage>(rawMessage, { 'TContent': WsServiceResponseMessage });
				await this.handleServiceResponse(message);
			}
		});
		this.websocket.connect();
		await this.websocket.connected;
	}

	async subscribe(eventNameOrConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		await this.initWebSocket();
		const subscription: EventSubscription = await super.subscribeLocal(eventNameOrConstructor, handler);
		subscription.context = context;
		// if subscription for this event name has not already been sent to server - send it
		if (this.eventSubscriptions[subscription.eventName].eventHandlers.size === 1) {
			await this.sendEventSubscription(subscription.eventName, subscription.additionalData);
		}
		return subscription;
	}

	private async sendEventSubscription(eventName: string, additionalData: any): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			this.pendingEventSubscriptions.set(eventName, { resolve, reject });
			const content: string | ArrayBuffer = this.config.serializer.serialize(<WsMessage<EventSubscription>>{
				type: 'subscribe_event',
				content: {
					clientId: this.id,
					eventName: eventName,
					additionalData: additionalData,
				}
			});
			this.websocket.send(content);
		});
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		eventName = subscription?.eventName ?? eventName;
		subscription = await super.unsubscribeLocal(subscription, eventName);
		if (this.websocket?.connected) {
			await this.websocket.connected;
			// no mor handlers for this event registered - so unsubscribe on server
			if (!this.eventSubscriptions[eventName]?.eventHandlers?.size) {
				await this.sendEventUnSubscription(eventName, subscription?.additionalData);
			}
		}
	}

	private async sendEventUnSubscription(eventName: string, additionalData: any): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			this.pendingEventUnSubscriptions.set(eventName, { resolve, reject });
			const content: string | ArrayBuffer = this.config.serializer.serialize(<WsMessage<EventSubscription>>{
				type: 'unsubscribe_event',
				content: {
					clientId: this.id,
					eventName: eventName,
					additionalData: additionalData,
				}
			});
			this.websocket.send(content);
		});
	}

	async removeClient(_clientId: string): Promise<void> {
	}

	emit(_eventName: string, _event: any, _context: ExecutionContext): any {
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(_subscriptionData: EventSubscription): Promise<void> {
		throw new Error('NotImplemented');
	}

	private async handleServiceResponse(message: WsMessage<WsServiceResponseMessage>) {
		const pendingRequest = this.pendingRequests.get(message.content.id);
		if (!pendingRequest) {
			Nanium.logger.error('browserWS: no pending request found for response with id: ' + message.content.id);
			return;
		}
		this.pendingRequests.delete(message.content.id);

		// error
		if (message.content.error) {
			if (this.config.handleError) {
				try {
					await this.config.handleError(message.content.error);
				} catch (e) {
					pendingRequest.reject(e);
				}
			} else {
				pendingRequest.reject(message.content.error);
			}
		}

		// parse response
		const response = NaniumObject.create(message.content.response, pendingRequest.request.constructor[responseTypeSymbol]);

		// execute response interceptors
		if (this.config.responseInterceptors?.length) {
			let responseFromInterceptor: any;
			for (const interceptor of this.config.responseInterceptors) {
				responseFromInterceptor = await (typeof interceptor === 'function' ? new interceptor() : interceptor)
					.execute(pendingRequest.request, response);
				// if an interceptor returns an object other than the original response instance, the returned value will replace the original response;
				if (responseFromInterceptor !== undefined && responseFromInterceptor !== response) {
					pendingRequest.resolve(responseFromInterceptor);
				}
			}
		}

		pendingRequest.resolve(response);
	}
}
