import { Nanium } from '../../core';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { ExecutionContext } from '../../interfaces/executionContext';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ServiceManager } from '../../interfaces/serviceManager';
import { NaniumObject, NaniumPropertyInfoCore } from '../../objects';
import { getPrimaryResponseType } from '../core';
import {
	EmitEventMessageContent,
	SubscribeEventMessageContent,
	WsMessage,
	WsServiceChunkMessage,
	WsServiceRequestMessage
} from '../providers/channels/ws.types';
import { initStream, parseMessage, sendBufferInChunks, sendMessage } from '../ws.core';
import { ConsumerBase } from './base';
import { WebSocketClient } from './ws.core';

export interface NaniumConsumerBrowserWebsocketConfig extends ServiceConsumerConfig {
	// apiUrl?: string;
	apiEventUrl?: string;
	binaryChunkSize?: number;
	// onServerConnectionRestored?: () => void;
}

export class NaniumConsumerBrowserWebsocket extends ConsumerBase<NaniumConsumerBrowserWebsocketConfig> implements ServiceManager {
	private websocket?: WebSocketClient;
	private pendingEventSubscriptions: Map<string, { resolve: Function, reject: Function }> = new Map();
	private pendingEventUnSubscriptions: Map<string, { resolve: Function, reject: Function }> = new Map();
	private pendingRequests: Map<string, PendingRequestInfo> = new Map();

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

			// buffers in request
			const buffers: NaniumBuffer[] = [];
			NaniumObject.forEachProperty(request, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
				// todo: support buffers as generic types  (e.g. Array<NaniumBuffer>)
				if (typeInfo?.ctor && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					if (parent[prop]) {
						buffers.push(parent[prop] as NaniumBuffer);
						parent[prop] = new NaniumBuffer();
						parent[prop].id = buffers[buffers.length - 1].id;
					}
				}
			});

			// streams in request
			NaniumObject.forEachProperty(request, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
				// todo: support streams as generic types (e.g. Array<NaniumStream>)
				if (typeInfo?.ctor && NaniumStream.isNaniumStream(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					if (parent[prop]) {
						initStream(parent[prop], typeInfo.localGenerics, msg.content.id,
							data => this.websocket.send(data), this.config.serializer);
					}
				}
			});

			// send
			await sendMessage(msg, this.config.serializer, data => this.websocket.send(data));
			for (const buffer of buffers) {
				await sendBufferInChunks(buffer, msg.content.id,
					data => this.websocket.send(data), 'service_buffer_chunk',
					this.config.serializer, this.config.binaryChunkSize);
			}
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
			const rawMessage: WsMessage = await parseMessage(event.data, this.config.serializer);
			if (rawMessage.type === 'emit_event') {
				const message = new WsMessage<EmitEventMessageContent>(rawMessage, { 'TContent': EmitEventMessageContent });
				await super.receiveEventLocal(message.content.eventName, message.content.event);
			} else if (rawMessage.type === 'subscription_result') {
				const message = new WsMessage<SubscribeEventMessageContent>(rawMessage, { 'TContent': SubscribeEventMessageContent });
				const promiseFunctions = this.pendingEventSubscriptions.get(message.content.eventName);
				this.pendingEventSubscriptions.delete(message.content.eventName);
				if (message.error) {
					promiseFunctions.reject(message.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'unsubscription_result') {
				const message = new WsMessage<SubscribeEventMessageContent>(rawMessage, { 'TContent': SubscribeEventMessageContent });
				const promiseFunctions = this.pendingEventUnSubscriptions.get(message.content.eventName);
				this.pendingEventUnSubscriptions.delete(message.content.eventName);
				if (message.error) {
					promiseFunctions.reject(message.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'service_response') {
				await this.handleServiceResponse(rawMessage);
			} else if (rawMessage.type === 'service_buffer_chunk') {
				await this.handleResponseBufferChunk(rawMessage);
			} else if (rawMessage.type === 'service_stream_chunk') {
				await this.handleResponseStreamChunk(rawMessage);
			} else if (rawMessage.type === 'service_stream_end') {
				await this.handleResponseStreamEnd(rawMessage);
			} else if (rawMessage.type === 'service_stream_error') {
				await this.handleResponseStreamError(rawMessage);
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
		await new Promise<void>(async (resolve: Function, reject: Function) => {
			this.pendingEventSubscriptions.set(eventName, { resolve, reject });
			await sendMessage(<WsMessage<EventSubscription>>{
				type: 'subscribe_event',
				content: {
					clientId: this.id,
					eventName: eventName,
					additionalData: additionalData,
				}
			}, this.config.serializer, data => this.websocket.send(data));
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
			sendMessage(<WsMessage<EventSubscription>>{
				type: 'unsubscribe_event',
				content: {
					clientId: this.id,
					eventName: eventName,
					additionalData: additionalData,
				}
			}, this.config.serializer, data => this.websocket.send(data));
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

	private async handleServiceResponse(message: WsMessage): Promise<void> {
		const pendingRequest = this.pendingRequests.get(message.content.requestId);
		if (!pendingRequest) {
			Nanium.logger.error('browserWS: no pending request found for response with id: ' + message.content.requestId);
			return;
		}

		// error
		if (message.error) {
			if (this.config.handleError) {
				try {
					await this.config.handleError(message.error);
				} catch (e) {
					pendingRequest.reject(e);
					return;
				}
			} else {
				pendingRequest.reject(message.error);
				return;
			}
		}

		// parse response
		const ResponseType = getPrimaryResponseType(pendingRequest.request);
		// handle buffers inside object response
		pendingRequest.pendingResponseBuffers = [];
		if (NaniumBuffer.isNaniumBuffer(ResponseType) && message.content.response) {
			pendingRequest.response = new NaniumBuffer(undefined, message.content.response.id);
			pendingRequest.pendingResponseBuffers.push(pendingRequest.response);
		} else {
			pendingRequest.response = NaniumObject.create(message.content.response, ResponseType);
			NaniumObject.forEachProperty(pendingRequest.response, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					if (parent[prop]) {
						pendingRequest.pendingResponseBuffers.push(parent[prop] as NaniumBuffer);
					}
				}
			});
		}

		// handle stream responses and streams inside object response
		pendingRequest.openResponseStreams = [];
		if (NaniumStream.isNaniumStream(ResponseType) && message.content.response) {
			pendingRequest.response = new NaniumStream(undefined, undefined, message.content.response.id);
			pendingRequest.openResponseStreams.push(pendingRequest.response);
		} else {
			pendingRequest.response = NaniumObject.create(message.content.response, ResponseType);
			// todo: performance - checking if ResponseType has NaniumStream properties is faster than checking the while response object (e.g. if response returns an array with 1000 objects)
			NaniumObject.forEachProperty(pendingRequest.response, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					if (parent[prop]) {
						pendingRequest.openResponseStreams.push(parent[prop] as NaniumStream);
					}
				}
			});
		}

		await this.tryFinalizeResponse(pendingRequest, message.content.requestId);
	}

	async handleResponseBufferChunk(message: WsMessage<WsServiceChunkMessage>) {
		const pendingRequest = this.pendingRequests.get(message.content.requestId);
		const idx = pendingRequest.pendingResponseBuffers!.findIndex(b => b.id === message.content.bufferOrStreamId);
		await pendingRequest.pendingResponseBuffers[idx].write(message.payload);
		if (message.content.isLastChunk) {
			pendingRequest.pendingResponseBuffers.splice(idx, 1);
		}
		await this.tryFinalizeResponse(pendingRequest, message.content.requestId);
	}

	async handleResponseStreamChunk(message: WsMessage<WsServiceChunkMessage>) {
		const pendingRequest = this.pendingRequests.get(message.content.requestId);
		await pendingRequest.openResponseStreams!.find(b => b.id === message.content.bufferOrStreamId)
			?.write(message.payload);
	}

	async handleResponseStreamEnd(message: WsMessage<WsServiceChunkMessage>) {
		const pendingRequest = this.pendingRequests.get(message.content.requestId);
		const idx = pendingRequest.openResponseStreams!.findIndex(b => b.id === message.content.bufferOrStreamId);
		pendingRequest.openResponseStreams[idx].end();
		pendingRequest.openResponseStreams.splice(idx, 1);
	}

	async handleResponseStreamError(message: WsMessage<WsServiceChunkMessage>) {
		const pendingRequest = this.pendingRequests.get(message.content.requestId);
		const idx = pendingRequest.openResponseStreams!.findIndex(b => b.id === message.content.bufferOrStreamId);
		pendingRequest.openResponseStreams[idx].error(message.error);
		pendingRequest.openResponseStreams.splice(idx, 1);
	}

	async tryFinalizeResponse(pendingRequest: PendingRequestInfo, requestId: string) {
		// continue if all data received?
		if (pendingRequest.pendingResponseBuffers?.length) {
			return;
		}

		// execute interceptors
		if (this.config.responseInterceptors?.length) {
			let responseFromInterceptor: any;
			for (const interceptor of this.config.responseInterceptors) {
				responseFromInterceptor = await (typeof interceptor === 'function' ? new interceptor() : interceptor)
					.execute(pendingRequest.request, pendingRequest.response);
				// if an interceptor returns an object other than the original response instance, the returned value will replace the original response;
				if (responseFromInterceptor !== undefined && responseFromInterceptor !== pendingRequest.response) {
					pendingRequest.resolve(responseFromInterceptor);
				}
			}
		}

		// resolve promise and remove from pending requests
		this.pendingRequests.delete(requestId);
		pendingRequest.resolve(pendingRequest.response);
	}
}

class PendingRequestInfo {
	request: any;
	response?: any;
	resolve: Function;
	reject: Function;
	pendingResponseBuffers?: NaniumBuffer[];
	openResponseStreams?: NaniumStream[];
}
