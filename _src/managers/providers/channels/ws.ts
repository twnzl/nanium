import { Nanium } from '../../../core';
import { ChannelConfig } from '../../../interfaces/channelConfig';
import { Channel } from '../../../interfaces/channel';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager';
import * as WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import {
	SubscribeEventmessageContent,
	WsMessage,
	WsServiceBufferChunkMessage,
	WsServiceRequestMessage
} from './ws.types';
import { NaniumObject, NaniumPropertyInfoCore } from '../../../objects';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { getPrimaryResponseType } from '../../core';
import { parseMessage, sendBufferInChunks, sendMessage } from '../../ws.core';

const clientIdSymbol: symbol = Symbol.for('__client_id__');

export interface NaniumWebsocketChannelConfig extends ChannelConfig {
	server: HttpServer | HttpsServer | { use: Function };
	binaryChunkSize?: number;
}

export class NaniumWebsocketChannel implements Channel {
	manager: ServiceProviderManager;
	onClientRemoved: ((clientId: string) => void)[] = [];

	private readonly config: NaniumWebsocketChannelConfig;
	private wss: WebSocket.Server;
	private clientSubscriptionInfo: Map<string, ClientSubscriptionInfo> = new Map(); // first client ID
	private serviceRepository: NaniumRepository;
	private arrivingRequests: Map<string, {
		request?: any,
		buffers?: NaniumBuffer[],
		resolve?: Function,
		reject?: Function,
	}> = new Map();

	constructor(public id: string, config: NaniumWebsocketChannelConfig) {
		this.config = {
			...<NaniumWebsocketChannelConfig>{
				server: undefined,
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
				binaryChunkSize: 1024 * 1024, // 1MB
			},
			...(config || {})
		};
	}

	async init(serviceRepository: NaniumRepository, _manager: ServiceProviderManager): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.wss = new WebSocket.Server({ server: this.config.server });
		this.wss.on('connection', (ws: WebSocket) => {
			// Handle messages from the client
			ws.on('message', (rawMessage: ArrayBuffer | string) => {
				try {
					this.handleIncomingMessage(rawMessage, ws);
				} catch (e) {
					sendMessage(<WsMessage>{
						type: 'service_response',
						error: e,
						content: null
					}, this.config.serializer, data => ws.send(data));

				}
			});

			// Handle client disconnection
			ws.on('close', () => {
				// remove subscriptions of this socket
				this.removeClient(ws[clientIdSymbol]);
			});

			// Handle errors
			ws.on('error', (error: Error) => {
				throw error;
			});
		});
	}

	async terminate(): Promise<void> {
		const perClient = this.clientSubscriptionInfo.values();
		for (const clientSubscription of perClient) {
			clientSubscription.websocket.terminate();
		}
		this.clientSubscriptionInfo = new Map();
	};

	removeClient?(clientId: string) {
		if (clientId) {
			this.clientSubscriptionInfo.delete(clientId);
			for (const handler of this.onClientRemoved) {
				handler(clientId);
			}
		}
	}

	private async handleIncomingMessage(rawMessage: ArrayBuffer | string, ws: WebSocket): Promise<void> {
		const message: WsMessage = await parseMessage(rawMessage, this.config.serializer);
		// const message: WsMessage = this.config.serializer.deserialize(rawMessage);
		switch (message.type) {
			case 'subscribe_event':
				return this.handleIncomingEventSubscription(message, ws);
			case 'unsubscribe_event':
				return this.handleIncomingEventUnsubscription(message, ws);
			case 'service_request':
				return this.handleIncomingServiceRequest(message, ws);
			case 'service_request_buffer_chunk':
				return this.handleIncomingServiceRequestBufferChunk(message, ws);
		}
	}

	//#region service request handling
	async handleIncomingServiceRequest(message: WsMessage<WsServiceRequestMessage>, ws: WebSocket): Promise<any> {
		const serviceName: string = message.content.serviceName;
		let ResponseType = getPrimaryResponseType(this.serviceRepository, serviceName);
		try {
			const request = NaniumObject.create(message.content.request, this.serviceRepository[serviceName].Request);

			// buffers in request
			const buffers: NaniumBuffer[] = [];
			NaniumObject.forEachProperty(request, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					buffers.push(parent[prop] as NaniumBuffer);
				}
			});
			if (buffers?.length) {
				this.arrivingRequests.set(message.content.id, { request, buffers });
				await new Promise(async (resolve: Function, reject: Function): Promise<void> => {
					this.arrivingRequests.get(message.content.id).resolve = resolve;
					this.arrivingRequests.get(message.content.id).reject = reject;
					// handleIncomingServiceRequestBufferChunk will resolve this when all request data arrived
				});
			}

			const result: any = await Nanium.execute(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));

			// buffer response
			if (NaniumBuffer.isNaniumBuffer(ResponseType)) {
				const responseMessage: WsMessage<WsServiceBufferChunkMessage> = {
					type: 'service_response',
					content: {
						requestId: message.content.id,
						response: result ? new NaniumBuffer(undefined, (result as NaniumBuffer).id) : undefined
					}
				};
				await sendMessage(responseMessage, this.config.serializer, data => ws.send(data));
				if (result) {
					await sendBufferInChunks(result, message.content.id, data => ws.send(data),
						'service_response_buffer_chunk', this.config.serializer, this.config.binaryChunkSize);
				}
			}

			// stream response
			else if (NaniumStream.isNaniumStream(ResponseType)) {
				// todo: add handling of Streams
				throw new Error('not yet implemented');
			}

			// normal response
			else {
				// buffers inside response object
				const resBuffers: NaniumBuffer[] = [];
				// todo: optimize: not performant for large arrays in response
				NaniumObject.forEachProperty(result, (name: string[], parent: Object, typeInfo: NaniumPropertyInfoCore) => {
					if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
						const prop = name[name.length - 1];
						if (parent[prop]) {
							resBuffers.push(parent[prop] as NaniumBuffer);
							parent[prop] = new NaniumBuffer(undefined, (parent[prop] as NaniumBuffer).id); // replace with buffer that only holds the id, not the data to send only this in the answer request
						}
					}
				});
				const responseMessage: WsMessage<WsServiceBufferChunkMessage> = {
					type: 'service_response',
					content: {
						requestId: message.content.id,
						response: result
					}
				};
				await sendMessage(responseMessage, this.config.serializer, data => ws.send(data));
				// send buffer chunks
				for (const buffer of resBuffers) {
					await sendBufferInChunks(buffer, responseMessage.content.requestId,
						data => ws.send(data), 'service_response_buffer_chunk',
						this.config.serializer, this.config.binaryChunkSize);
				}
			}
		} catch (e) {
			if (e instanceof Error) {
				e = e.message;
			}
			const responseMessage: WsMessage<WsServiceBufferChunkMessage> = {
				type: 'service_response',
				error: e,
				content: {
					requestId: message.content.id,
				}
			};
			await sendMessage(responseMessage, this.config.serializer, data => ws.send(data));
		}
	}

	async handleIncomingServiceRequestBufferChunk(message: WsMessage<WsServiceBufferChunkMessage>, ws: WebSocket): Promise<any> {
		try {
			const arrivingRequest = this.arrivingRequests.get(message.content.requestId);
			if (!arrivingRequest) {
				throw new Error('pending request not found');
			}
			const buffer = arrivingRequest.buffers?.find(b => b.id === message.content.bufferId);
			if (!buffer) {
				arrivingRequest.reject(
					new Error('buffer not found: ' + message.content.bufferId + ' in request ' + message.content.requestId)
				);
			}

			buffer.write(message.payload);
			if (message.content.isLastChunk) {
				arrivingRequest.buffers.splice(arrivingRequest.buffers.indexOf(buffer), 1);
			}
			if (!arrivingRequest.buffers.length) {
				arrivingRequest.resolve();
			}
		} catch (e) {
			if (e instanceof Error) {
				e = e.message;
			}
			const responseMessage: WsMessage<WsServiceBufferChunkMessage> = {
				type: 'service_response',
				error: e,
				content: message.content
			};
			await sendMessage(responseMessage, this.config.serializer, data => ws.send(data));
		}
	}

	//#endregion service request handling

	//#region event handling
	private async handleIncomingEventSubscription(message: WsMessage<EventSubscription>, ws: WebSocket): Promise<void> {
		Nanium.logger.info('channel ws: incoming event subscription: ', message.content.eventName);
		// ask the manager to execute interceptors and to decide if the subscription is accepted or not
		const subscription: EventSubscription = message?.content;
		let error: any;
		try {
			subscription.channelId = this.id;
			await Nanium.receiveSubscription(subscription, false);
			ws[clientIdSymbol] ??= message.content.clientId;
			if (!this.clientSubscriptionInfo.has(subscription.clientId)) {
				this.clientSubscriptionInfo.set(subscription.clientId, new ClientSubscriptionInfo(ws));
			}
			const subscriptionsOfClient = this.clientSubscriptionInfo.get(subscription.clientId);
			if (subscriptionsOfClient.eventNames.has(subscription.eventName)) {
				Nanium.logger.info(`duplicat event subscription: eventName=${subscription.eventName}, clientId = ${subscription.clientId}`);
			} else {
				subscriptionsOfClient.eventNames.add(subscription.eventName);
			}
		} catch (e) {
			error = e;
		} finally {
			const message = new WsMessage<SubscribeEventmessageContent>({
				type: 'subscription_result',
				error: error,
				content: {
					eventName: subscription.eventName,
				}
			});
			await sendMessage(message, this.config.serializer, data => ws.send(data));
		}
	}

	private async handleIncomingEventUnsubscription(message: WsMessage<EventSubscription>, ws: WebSocket): Promise<void> {
		Nanium.logger.info('channel ws: incoming event unsubscription: ', message.content.eventName);
		let error: any;
		let clientSubscription: ClientSubscriptionInfo;
		try {
			//todo: create real instances of EventSubscription and additionalData  e.g:
			// const subscriptionData: EventSubscription = NaniumObject.create(
			// 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
			// 	EventSubscription,
			// 	{'TData': this.config.subscriptionDataConstructor}
			// );

			// remove subscription
			clientSubscription = this.clientSubscriptionInfo.get(message.content.clientId);
			if (clientSubscription) {
				clientSubscription.eventNames.delete(message.content.eventName);
			}
			// unsubscribe core
			await Nanium.unsubscribe(message.content);
		} catch (e) {
			error = e;
		} finally {
			const response = new WsMessage<SubscribeEventmessageContent>({
				type: 'unsubscription_result',
				error: error,
				content: {
					eventName: message.content.eventName,
				}
			});
			await sendMessage(response, this.config.serializer, data => ws.send(data));
			// close websocket if no other subscriptions exist.
			if (!clientSubscription?.eventNames?.size) {
				clientSubscription.websocket?.close();
				this.clientSubscriptionInfo.delete(message.content.clientId);
			}
		}
	}

	async emitEvent(event: any, subscription?: EventSubscription): Promise<void> {
		const message: WsMessage = {
			type: 'emit_event',
			content: {
				eventName: event.constructor.eventName ?? subscription?.eventName,
				event
			}
		};
		const clientSubscription = this.clientSubscriptionInfo.get(subscription.clientId);
		try {
			if (clientSubscription?.eventNames?.has(message.content.eventName)) {
				await sendMessage(message, this.config.serializer, data => clientSubscription.websocket?.send(data));
			}
		} catch (e) {
			Nanium.logger.error('websocket channel: emitEvent: ', e.message, e.stack);
		}
	}

	//#endregion event handling

}

class ClientSubscriptionInfo {
	eventNames: Set<string> = new Set<string>();

	constructor(public websocket: WebSocket) {
	}
}
