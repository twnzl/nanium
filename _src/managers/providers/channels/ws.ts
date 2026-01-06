import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import * as WebSocket from 'ws';
import { Nanium } from '../../../core';
import { AsyncHelper, criticalSection, ExtendedTimeout, Mutex, setExtendedTimeout } from '../../../helper';
import { Channel } from '../../../interfaces/channel';
import { ChannelConfig } from '../../../interfaces/channelConfig';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { ConstructorType, genericTypesSymbol, NaniumObject, NaniumPropertyInfoCore } from '../../../objects';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { getPrimaryResponseType, getSecondaryResponseType } from '../../core';
import { initStream, parseMessage, sendBufferInChunks, sendMessage } from '../../ws.core';
import { SubscribeEventMessageContent, WsMessage, WsServiceChunkMessage, WsServiceRequestMessage } from './ws.types';

const clientIdSymbol: symbol = Symbol.for('__client_id__');
const sourceSymbol: symbol = Symbol.for('__source__');
const hasBuffersSymbol: symbol = Symbol.for('__has_buffers__');
const hasStreamsSymbol: symbol = Symbol.for('__has_streams__');

export interface NaniumWebsocketChannelConfig extends ChannelConfig {
	server: HttpServer | HttpsServer;
	binaryChunkSize?: number;
	maxBufferSize?: number;
	streamAndBufferTimeout?: number;
}

export class NaniumWebsocketChannel implements Channel {
	manager: ServiceProviderManager;
	onClientRemoved: ((clientId: string) => void)[] = [];

	private readonly config: NaniumWebsocketChannelConfig;
	private wss: WebSocket.Server;
	private clientSubscriptionInfo: Map<string, ClientSubscriptionInfo> = new Map(); // first client ID
	private serviceRepository: NaniumRepository;
	private parseMessageMutex: Mutex = new Mutex();
	private arrivingRequests: Map<string, {
		request?: any,
		buffers?: NaniumBuffer[],
		resolve?: (result?: unknown) => void,
		reject?: (err?: unknown) => void,
		timeout?: ExtendedTimeout,
	}> = new Map();
	private openRequestStreams: Map<string, {
		type: NaniumPropertyInfoCore,
		stream?: NaniumStream,
		timeout?: ExtendedTimeout,
	}> = new Map();

	// private openResponseStreams: Map<string, {
	// 	type: NaniumPropertyInfoCore,
	// 	stream?: NaniumStream,
	// }> = new Map();

	constructor(public id: string, config: NaniumWebsocketChannelConfig) {
		this.config = {
			...<NaniumWebsocketChannelConfig>{
				server: undefined,
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
				binaryChunkSize: 1024 * 1024, // 1MB
				maxBufferSize: 1024 * 1024, // 1Mb
				streamAndBufferTimeout: 5000,
			},
			...(config || {})
		};
	}

	async send(ws: WebSocket, data) {
		ws.send(data);
		while (ws.bufferedAmount > this.config.maxBufferSize) {
			await AsyncHelper.pause(10); // Wait if buffer is too full
		}
	}

	init(serviceRepository: NaniumRepository, _manager: ServiceProviderManager): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.wss = new WebSocket.Server({ server: this.config.server });
		this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
			ws[sourceSymbol] = this.getClientIp(req);

			// Handle messages from the client
			ws.on('message', (rawMessage: ArrayBuffer | string) => {
				try {
					void this.handleIncomingMessage(rawMessage, ws);
				} catch (e) {
					void sendMessage(<WsMessage>{
						type: 'service_response',
						error: e,
						content: null
					}, this.config.serializer, async data => await this.send(ws, data));
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
		return Promise.resolve();
	}

	terminate(): Promise<void> {
		const perClient = this.clientSubscriptionInfo.values();
		for (const clientSubscription of perClient) {
			clientSubscription.websocket.terminate();
		}
		this.clientSubscriptionInfo = new Map();
		return Promise.resolve();
	};

	getClientIp(req: IncomingMessage): string {
		const forwardedFor = req.headers['x-forwarded-for'];
		if (forwardedFor && typeof forwardedFor === 'string') {
			return forwardedFor.split(',')[0].trim();
		}
		return req.socket.remoteAddress;
	}

	removeClient?(clientId: string) {
		if (clientId) {
			this.clientSubscriptionInfo.delete(clientId);
			for (const handler of this.onClientRemoved) {
				handler(clientId);
			}
		}
	}

	private async handleIncomingMessage(rawMessage: ArrayBuffer | string, ws: WebSocket): Promise<void> {
		let message: WsMessage;
		// parseMessage has different speeds for different messages and so messages overtake each other
		// what is critical e.g. for thinks like stream_chunk and stream_end -> criticalSection ensures order
		await criticalSection(this.parseMessageMutex, async () => {
			message = await parseMessage(rawMessage, this.config.serializer);
		});
		switch (message.type) {
			case 'subscribe_event':
				return this.handleIncomingEventSubscription(message, ws);
			case 'unsubscribe_event':
				return this.handleIncomingEventUnsubscription(message, ws);
			case 'service_request':
				return this.handleIncomingServiceRequest(message, ws);
			case 'service_buffer_chunk':
				return this.handleIncomingServiceRequestBufferChunk(message, ws);
			case 'service_stream_chunk':
				return this.handleIncomingServiceRequestStreamChunk(message, ws);
			// case 'service_request_stream_objects':
			// 	return this.handleIncomingServiceRequestStreamObjects(message, ws);
			case 'service_stream_end':
				return this.handleIncomingServiceRequestStreamEnd(message, ws);
			case 'service_stream_error':
				return this.handleIncomingServiceRequestStreamError(message, ws);
			default:
				Nanium.logger.error(message.error ?? 'unknown ws message');
		}
	}

	//#region service request handling
	async handleIncomingServiceRequest(message: WsMessage<WsServiceRequestMessage>, ws: WebSocket): Promise<any> {
		const serviceName: string = message.content.serviceName;
		const ResponseType = getPrimaryResponseType(this.serviceRepository, serviceName);
		const SubType = getSecondaryResponseType(this.serviceRepository, serviceName);
		try {
			const request = NaniumObject.create(message.content.request, this.serviceRepository[serviceName].Request);

			// buffers in request
			const buffers: NaniumBuffer[] = [];
			NaniumObject.forEachProperty(request, (name: string[], parent: object, typeInfo: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					buffers.push(parent[prop] as NaniumBuffer);
				}
			});
			if (buffers?.length) {
				this.arrivingRequests.set(message.content.id, { request, buffers });
				await new Promise<void>((resolve: (result: void) => void, reject: (err: Error | unknown) => void) => {
					this.arrivingRequests.get(message.content.id).resolve = resolve;
					this.arrivingRequests.get(message.content.id).reject = reject;
					this.arrivingRequests.get(message.content.id).timeout = setExtendedTimeout(() => {
						// close/cleanup buffers if not used for a while
						this.arrivingRequests.get(message.content.id).reject(new Error('buffer timeout'));
						this.arrivingRequests.delete(message.content.id);
					}, this.config.streamAndBufferTimeout);
					// handleIncomingServiceRequestBufferChunk will resolve this when all request data arrived
				});
			}
			// streams in request
			NaniumObject.forEachProperty(request, (name: string[], parent: object, typeInfo: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					if (parent[prop]) {
						const stream: NaniumStream = parent[prop];
						this.openRequestStreams.set(stream.id, {
							stream: stream, type: typeInfo, timeout: setExtendedTimeout(() => {
								// close/cleanup streams if not used for a while
								stream.error(new Error('stream timeout'));
								this.openRequestStreams.delete(stream.id);
							}, this.config.streamAndBufferTimeout)
						});
					}
				}
			});

			const executionContext = new this.config.executionContextConstructor({
				scope: 'public',
				source: ws[sourceSymbol]
			});
			const result: any = await Nanium.execute(request, serviceName, executionContext);

			// buffer response
			if (NaniumBuffer.isNaniumBuffer(ResponseType)) {
				const responseMessage: WsMessage<WsServiceChunkMessage> = {
					type: 'service_response',
					content: {
						requestId: message.content.id,
						response: result ? new NaniumBuffer(undefined, (result as NaniumBuffer).id) : undefined
					}
				};
				await sendMessage(responseMessage, this.config.serializer, async data => this.send(ws, data));
				if (result) {
					await sendBufferInChunks(result, message.content.id, async data => this.send(ws, data),
						'service_buffer_chunk', this.config.serializer, this.config.binaryChunkSize);
				}
			}

			// stream response
			else if (NaniumStream.isNaniumStream(ResponseType)) {
				const responseMessage: WsMessage<WsServiceChunkMessage> = {
					type: 'service_response',
					content: {
						requestId: message.content.id,
						response: result ? new NaniumStream() : undefined
					}
				};
				responseMessage.content.response.id = (result as NaniumStream).id;
				await sendMessage(responseMessage, this.config.serializer, async data => ws.send(data));
				if (result) {
					// this.openResponseStreams.set(result.id, { stream: result, type: typeInfo });
					initStream(
						result,
						SubType ?? NaniumBuffer,
						message.content.id,
						async data => this.send(ws, data),
						this.config.serializer,
						this.config.binaryChunkSize,
					);
				}
			}

			// normal response
			else {
				let hasGenericBuffers: boolean;
				let hasGenericStreams: boolean;
				if (ResponseType?.[genericTypesSymbol]) {
					hasGenericBuffers = Object.values(ResponseType[genericTypesSymbol]).some((t: any) => NaniumBuffer.isNaniumBuffer(t))
					hasGenericStreams = Object.values(ResponseType[genericTypesSymbol]).some((t: any) => NaniumStream.isNaniumStream(t))
				}
				// does response type contain buffers or Streams?
				if (ResponseType?.[hasBuffersSymbol] === undefined || ResponseType[hasStreamsSymbol] === undefined) {
					NaniumObject.traverseType(ResponseType, (name: string[], info: NaniumPropertyInfoCore) => {
						if (NaniumBuffer.isNaniumBuffer(info.ctor)) {
							ResponseType[hasBuffersSymbol] = true;
						}
						if (NaniumStream.isNaniumStream(info.ctor)) {
							ResponseType[hasStreamsSymbol] = true;
						}
					});
				}

				// buffers inside response object
				const resBuffers: NaniumBuffer[] = [];
				if (ResponseType?.[hasBuffersSymbol] || hasGenericBuffers) {
					NaniumObject.forEachProperty(result, (name: string[], parent: object, typeInfo: NaniumPropertyInfoCore) => {
						if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
							const prop = name[name.length - 1];
							if (parent[prop]) {
								resBuffers.push(parent[prop] as NaniumBuffer);
								parent[prop] = new NaniumBuffer(undefined, (parent[prop] as NaniumBuffer).id); // replace with buffer that only holds the id, not the data to send only this in the answer request
							}
						}
					});
				}

				// streams inside response object
				if (ResponseType?.[hasStreamsSymbol] || hasGenericStreams) {
					NaniumObject.forEachProperty(result, (name: string[], parent: object, typeInfo: NaniumPropertyInfoCore) => {
						if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
							const prop = name[name.length - 1];
							if (parent[prop]) {
								const stream: NaniumStream = parent[prop];
								// this.openResponseStreams.set(stream.id, { stream, type: typeInfo });
								// todo: set timeouts to close/cleanup streams if not used for a while
								initStream(
									stream,
									typeInfo.localGenerics,
									message.content.id,
									async data => this.send(ws, data),
									this.config.serializer,
									this.config.binaryChunkSize
								);
							}
						}
					});
				}

				// send basic response
				const responseMessage: WsMessage<WsServiceChunkMessage> = {
					type: 'service_response',
					content: {
						requestId: message.content.id,
						response: result
					}
				};
				await sendMessage(responseMessage, this.config.serializer, async data => this.send(ws, data));

				// send buffer chunks
				for (const buffer of resBuffers) {
					await sendBufferInChunks(buffer, responseMessage.content.requestId,
						async data => this.send(ws, data), 'service_buffer_chunk',
						this.config.serializer, this.config.binaryChunkSize);
				}
			}
		} catch (e) {
			const responseMessage: WsMessage<WsServiceChunkMessage> = {
				type: 'service_response',
				error: e instanceof Error ? e.message : e,
				content: {
					requestId: message.content.id,
				}
			};
			await sendMessage(responseMessage, this.config.serializer, async data => this.send(ws, data));
		}
	}

	async handleIncomingServiceRequestBufferChunk(message: WsMessage<WsServiceChunkMessage>, ws: WebSocket): Promise<any> {
		try {
			const arrivingRequest = this.arrivingRequests.get(message.content.requestId);
			if (!arrivingRequest) {
				return; // bad message or request already timed out and removed
			}
			arrivingRequest.timeout.restart();
			const buffer = arrivingRequest.buffers?.find(b => b.id === message.content.bufferOrStreamId);
			if (!buffer) {
				arrivingRequest.reject(
					new Error('buffer not found: ' + message.content.bufferOrStreamId + ' in request ' + message.content.requestId)
				);
			}

			// todo: implement check of maxSize to prevent from DOS attacks by filling Memory with uge data
			buffer.write(message.payload);
			if (message.content.isLastChunk) {
				arrivingRequest.timeout.cancel();
				arrivingRequest.buffers.splice(arrivingRequest.buffers.indexOf(buffer), 1);
			}
			if (!arrivingRequest.buffers.length) {
				arrivingRequest.resolve();
				this.arrivingRequests.delete(message.content.requestId);
			}
		} catch (e) {
			const responseMessage: WsMessage<WsServiceChunkMessage> = {
				type: 'service_response',
				error: e instanceof Error ? e.message : e,
				content: message.content
			};
			await sendMessage(responseMessage, this.config.serializer, async data => this.send(ws, data));
		}
	}

	handleIncomingServiceRequestStreamChunk(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket): any {
		const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
		if (!streamInfo) {
			return; // bad message or already timed out and removed
		}
		streamInfo.timeout.restart();
		if (NaniumBuffer.isNaniumBuffer(streamInfo.type.localGenerics)) { // binary
			streamInfo.stream.write(message.payload instanceof NaniumBuffer ? message.payload : new NaniumBuffer(message.payload));
		} else { // objects
			const deserialized = this.config.serializer.deserialize(message.payload);
			const obj = NaniumObject.create(deserialized, streamInfo.type.localGenerics as ConstructorType);
			streamInfo.stream.write(obj);
		}
	}

	handleIncomingServiceRequestStreamEnd(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket) {
		const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
		if (!streamInfo) {
			return; // bad message or already timed out and removed
		}
		streamInfo.timeout.cancel();
		streamInfo.stream.end();
		this.openRequestStreams.delete(message.content.bufferOrStreamId);
	}

	handleIncomingServiceRequestStreamError(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket) {
		const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
		if (!streamInfo) {
			return; // bad message or already timed out and removed
		}
		streamInfo.stream.error(message.error);
		this.openRequestStreams.delete(message.content.bufferOrStreamId);
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
			subscription.source = ws[sourceSymbol];
			await Nanium.receiveSubscription(subscription, false);
			ws[clientIdSymbol] ??= message.content.clientId;
			if (!this.clientSubscriptionInfo.has(subscription.clientId)) {
				this.clientSubscriptionInfo.set(subscription.clientId, new ClientSubscriptionInfo(ws));
			}
			const subscriptionsOfClient = this.clientSubscriptionInfo.get(subscription.clientId);
			if (subscriptionsOfClient.eventNames.has(subscription.eventName)) {
				Nanium.logger.info(`duplicate event subscription: eventName=${subscription.eventName}, clientId = ${subscription.clientId}`);
			} else {
				subscriptionsOfClient.eventNames.add(subscription.eventName);
			}
		} catch (e) {
			error = e;
		} finally {
			const message = new WsMessage<SubscribeEventMessageContent>({
				type: 'subscription_result',
				error: error,
				content: {
					eventName: subscription.eventName,
				}
			});
			await sendMessage(message, this.config.serializer, async data => this.send(ws, data));
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
			message.content.source = ws[sourceSymbol];
			await Nanium.unsubscribe(message.content);
		} catch (e) {
			error = e;
		} finally {
			const response = new WsMessage<SubscribeEventMessageContent>({
				type: 'unsubscription_result',
				error: error,
				content: {
					eventName: message.content.eventName,
				}
			});
			await sendMessage(response, this.config.serializer, async data => this.send(ws, data));
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
				await sendMessage(message, this.config.serializer, async data => this.send(clientSubscription.websocket, data));
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

