import { criticalSection, Mutex, RejectFunction, ResolveFunction, uuid } from '../../helper';
import { EventNameOrConstructor } from '../../interfaces/eventConstructor';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';
import { EventSubscriptionSendInterceptor } from '../../interfaces/eventSubscriptionInterceptor';
import { ExecutionContext } from '../../interfaces/executionContext';
import { NaniumLogger } from '../../interfaces/logger';
import { NaniumBuffer } from '../../interfaces/naniumBuffer';
import { NaniumStream } from '../../interfaces/naniumStream';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ServiceManager } from '../../interfaces/serviceManager';
import { ConstructorType, genericTypesSymbol, NaniumObject, NaniumPropertyInfoCore, responseTypeSymbol, streamTypeSymbol } from '../../objects';
import { getPrimaryResponseType, getSecondaryResponseType } from '../core';
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
	connectUrl?: string;
	binaryChunkSize?: number;
	streamAndBufferTimeout?: number;
}

export class NaniumConsumerBrowserWebsocket extends ConsumerBase<NaniumConsumerBrowserWebsocketConfig> implements ServiceManager {
	private websocket?: WebSocketClient;
	private pendingEventSubscriptions: Map<string, { resolve: ResolveFunction<void>, reject: RejectFunction }> = new Map();
	private pendingEventUnSubscriptions: Map<string, { resolve: ResolveFunction<void>, reject: RejectFunction }> = new Map();
	private pendingRequests: { [key: string]: PendingRequestInfo<any> } = {};
	private parseMessageMutex: Mutex = new Mutex();
	// private responsePromises: Promise<unknown>[] = [];

	constructor(config?: NaniumConsumerBrowserWebsocketConfig) {
		super(config);
		this.config.connectUrl = config?.connectUrl ?? '';
	}

	init(): Promise<void> {
		if (!this.config.connectUrl?.startsWith('ws://') && !this.config.connectUrl?.startsWith('wss://')) {
			this.config.connectUrl = ((window.location.protocol === 'http:') ? 'ws://' : 'wss://')
				+ window.location.host
				+ (this.config.connectUrl?.startsWith('/') ? '' : '/')
				+ this.config.connectUrl;
		}
		return Promise.resolve();
	}

	async terminate(): Promise<void> {
		this.websocket?.close();
		return Promise.resolve();
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
		return await this.config.isResponsible!(request, serviceName);
	}

	async execute<T>(serviceName: string, request: any, executionContext?: ExecutionContext): Promise<T> {
		// eslint-disable-next-line no-async-promise-executor
		return await new Promise<T>(async (resolve: ResolveFunction<T>, reject: RejectFunction) => {
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

			const requestId = uuid();
			const msg: WsMessage<WsServiceRequestMessage> = {
				type: 'service_request',
				content: {
					id: requestId,
					serviceName,
					request,
				}
			};
			const pendingRequest: PendingRequestInfo<any> = { request, resolve, reject, openRequestStreams: new Array<NaniumStream>() };
			this.pendingRequests[requestId] = pendingRequest;

			// buffers in request
			const buffers: NaniumBuffer[] = [];
			NaniumObject.forEachProperty(request, (name: string[], parent?: object, typeInfo?: NaniumPropertyInfoCore) => {
				// todo: support buffers as generic types  (e.g. Array<NaniumBuffer>)
				if (typeInfo?.ctor && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					const buffer: NaniumBuffer = (parent as any)[prop];
					if (buffer) {
						buffers.push(buffer);
						(parent as any)[prop] = new NaniumBuffer();
						(parent as any)[prop].id = buffer.id;
					}
				}
			});

			// streams in request
			if (NaniumStream.isNaniumStream(request.body)) {
				throw new Error('NaniumStream as ResponseBody not allowed. User custom Request-body-class with one or more NaniumStream properties');
			}
			NaniumObject.forEachProperty(request, (name: string[], parent?: object, typeInfo?: NaniumPropertyInfoCore) => {
				// todo: support streams as generic types (e.g. Array<NaniumStream>)
				if (typeInfo?.ctor && NaniumStream.isNaniumStream(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					const stream = (parent as any)[prop] as NaniumStream;
					if (stream) {
						pendingRequest.openRequestStreams!.push(stream);
						initStream(
							stream, typeInfo.localGenerics, msg.content.id,
							async data => this.websocket!.send(data), this.config.serializer!,
							this.config.binaryChunkSize
						);
					}
				}
			});

			// send
			await sendMessage(msg, this.config.serializer!, async data => await this.websocket!.send(data));
			for (const buffer of buffers) {
				await sendBufferInChunks(buffer, msg.content.id,
					async data => await this.websocket!.send(data), 'service_buffer_chunk',
					this.config.serializer!, this.config.binaryChunkSize);
			}
		});
	}

	private async initWebSocket() {
		if (this.websocket) {
			return this.websocket.connected;
		}
		if (!this.config.connectUrl) {
			throw new Error('browserWS: initWebSocket: connectUrl unknown');
		}
		this.websocket = new WebSocketClient(this.config.connectUrl);
		this.websocket.on('open', async (): Promise<void> => {
			// if reconnected, resubscribe to events
			if (this.eventSubscriptions) {
				await Promise.all(
					Object.values(this.eventSubscriptions)
						.map(s => this.sendEventSubscription(s.eventName, s.additionalData))
				);
			}
		});
		// this.websocket.on('close', async (): Promise<void> => {
		// 	console.log('browserWS: websocket closed', this.id, this.config.connectUrl);
		// });
		// this.websocket.on('error', async (err): Promise<void> => {
		// 	console.log('browserWS: websocket error', err, this.config.connectUrl);
		// });
		this.websocket.on('message', async event => {
			let rawMessage: WsMessage;
			// parseMessage has different speeds for different messages and so messages overtake each other
			// what is critical e.g. for thinks like stream_chunk and stream_end -> criticalSection ensures order
			await criticalSection(this.parseMessageMutex, async () => {
				rawMessage = await parseMessage(event.data, this.config.serializer!);
			});
			rawMessage = rawMessage!;
			if (rawMessage.type === 'emit_event') {
				const message = new WsMessage<EmitEventMessageContent>(rawMessage, { 'TContent': EmitEventMessageContent });
				await super.receiveEventLocal(message.content.eventName, message.content.event);
			} else if (rawMessage.type === 'subscription_result') {
				const message = new WsMessage<SubscribeEventMessageContent>(rawMessage, { 'TContent': SubscribeEventMessageContent });
				const promiseFunctions = this.pendingEventSubscriptions.get(message.content.eventName);
				if (promiseFunctions === undefined) {
					throw new Error('browserWS: on message: emit_event: promiseFunctions undefined');
				}
				this.pendingEventSubscriptions.delete(message.content.eventName);
				if (message.error) {
					promiseFunctions.reject(message.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'unsubscription_result') {
				const message = new WsMessage<SubscribeEventMessageContent>(rawMessage, { 'TContent': SubscribeEventMessageContent });
				const promiseFunctions = this.pendingEventUnSubscriptions.get(message.content.eventName);
				if (promiseFunctions === undefined) {
					throw new Error('browserWS: on message: unsubscription_result: promiseFunctions undefined');
				}
				this.pendingEventUnSubscriptions.delete(message.content.eventName);
				if (message.error) {
					promiseFunctions.reject(message.error);
				} else {
					promiseFunctions.resolve();
				}
			} else if (rawMessage.type === 'service_response') {
				// const requestId = (rawMessage as WsMessage<WsServiceChunkMessage>).content.requestId;
				// this.responsePromises[requestId] =
				await this.handleServiceResponse(rawMessage);
			} else if (rawMessage.type === 'service_buffer_chunk') {
				await this.handleResponseBufferChunk(rawMessage);
			} else if (rawMessage.type === 'service_stream_chunk') {
				await this.handleResponseStreamChunk(rawMessage);
			} else if (rawMessage.type === 'service_stream_end') {
				this.handleResponseStreamEnd(rawMessage);
			} else if (rawMessage.type === 'service_stream_error') {
				this.handleResponseStreamError(rawMessage);
			}
		});
		await this.websocket.connect();
	}

	async subscribe(eventNameOrConstructor: EventNameOrConstructor, handler: EventHandler, context?: ExecutionContext): Promise<EventSubscription> {
		await this.initWebSocket();
		// try {
		const subscription: EventSubscription = await super.subscribeLocal(eventNameOrConstructor, handler);
		subscription.context = context;
		// if subscription for this event name has not already been sent to server - send it
		if (this.eventSubscriptions[subscription.eventName].eventHandlers.size === 1) {
			await this.sendEventSubscription(subscription.eventName, subscription.additionalData);
		}
		return subscription;
		// } catch (e) {
		// 	console.error(e);
		// }
	}

	private async sendEventSubscription(eventName: string, additionalData: any): Promise<void> {
		// try {
		await new Promise<void>((resolve: (result: void) => void, reject: (err: Error | unknown) => void) => {
			this.pendingEventSubscriptions.set(eventName, { resolve, reject });
			void sendMessage(
				<WsMessage<EventSubscription>>{
					type: 'subscribe_event',
					content: {
						clientId: this.id,
						eventName: eventName,
						additionalData: additionalData,
					}
				}, this.config.serializer!, data => this.websocket!.send(data)
			);
		});
		// } catch (err) {
		// 	console.log('browserWS: sendEventSubscription: reject', eventName, this.id, err);
		// 	throw err;
		// };
	}

	async unsubscribe(subscription?: EventSubscription, eventName?: string): Promise<void> {
		// debugger;
		if (!this.eventSubscriptions) {
			return;
		}
		eventName = subscription?.eventName ?? eventName;
		if (eventName === undefined) {
			throw new Error('unsubscribe: event name undefined');
		}
		if (subscription) {
			this.eventSubscriptions[eventName]?.eventHandlers?.delete(subscription.id);
		}
		// if all subscriptions shall be unsubscribed or there are no more handlers for this event registered, then unsubscribe on server
		if (!subscription || !this.eventSubscriptions[eventName]?.eventHandlers?.size) {
			subscription = subscription ?? new EventSubscription(this.id, eventName);
			for (const interceptorOrClass of this.config.eventSubscriptionSendInterceptors ?? []) {
				const interceptor: EventSubscriptionSendInterceptor<any, any>
					= typeof interceptorOrClass === 'function' ? new interceptorOrClass() : interceptorOrClass;
				await interceptor.execute(this.eventSubscriptions[eventName]?.eventConstructor ?? eventName, subscription);
			}
			if (this.websocket?.connected) {
				await this.websocket.connected;
				await this.sendEventUnSubscription(eventName, subscription?.additionalData);
				delete this.eventSubscriptions[eventName];
			}
		}
	}

	private async sendEventUnSubscription(eventName: string, additionalData: any): Promise<void> {
		// try {
		await new Promise<void>((resolve: ResolveFunction<void>, reject: RejectFunction) => {
			this.pendingEventUnSubscriptions.set(eventName, { resolve, reject });
				void sendMessage(
					<WsMessage<EventSubscription>>{
						type: 'unsubscribe_event',
						content: {
							clientId: this.id,
							eventName: eventName,
							additionalData: additionalData,
						}
					}, this.config.serializer!, data => this.websocket!.send(data)
				)
			});
		// } catch (err) {
		// 	console.log('browserWS: sendEventUnSubscription: reject', eventName, this.id, err);
		// 	throw err;
		// }
	}

	async removeClient(_clientId: string): Promise<void> {
	}

	emit(_eventName: string, _event: any, _context: ExecutionContext): any {
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent!(eventName, context);
	}

	receiveSubscription(_subscriptionData: EventSubscription): Promise<void> {
		throw new Error('NotImplemented');
	}

	private async handleServiceResponse(message: WsMessage<WsServiceChunkMessage>): Promise<void> {
		const pendingRequest = this.pendingRequests[message.content.requestId];
		if (!pendingRequest) {
			NaniumLogger.error('browserWS: no pending request found for response with id: ' + message.content.requestId);
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
		const ResponseSubType = getSecondaryResponseType(pendingRequest.request);
		// handle buffers inside object response
		pendingRequest.pendingResponseBuffers = [];
		if (NaniumBuffer.isNaniumBuffer(ResponseType) && message.content.response) {
			pendingRequest.response = new NaniumBuffer(undefined, message.content.response.id);
			pendingRequest.pendingResponseBuffers.push(pendingRequest.response);
		} else {
			pendingRequest.response = NaniumObject.create(message.content.response, ResponseType as ConstructorType, pendingRequest.request.constructor[genericTypesSymbol]);

			NaniumObject.forEachProperty(pendingRequest.response, (name: string[], parent?: object, typeInfo?: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					const item = (parent as any)[prop];
					if (item) {
						pendingRequest.pendingResponseBuffers!.push(item as NaniumBuffer);
					}
				}
			});
		}

		// handle stream responses and streams inside object response
		pendingRequest.openResponseStreams = [];
		if (NaniumStream.isNaniumStream(ResponseType!) && message.content.response) {
			pendingRequest.response = new NaniumStream(message.content.response.id);
			pendingRequest.response[streamTypeSymbol] = ResponseSubType;
			pendingRequest.openResponseStreams.push(pendingRequest.response);
		} else {
			// todo: performance - checking if ResponseType has NaniumStream properties is faster than checking the while response object (e.g. if response returns an array with 1000 objects)
			NaniumObject.forEachProperty(pendingRequest.response, (name: string[], parent?: object, typeInfo?: NaniumPropertyInfoCore) => {
				if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
					const prop = name[name.length - 1];
					const item = (parent as any)[prop];
					if (item) {
						item[streamTypeSymbol] = typeInfo.localGenerics;
						pendingRequest.openResponseStreams!.push(item as NaniumStream);
					}
				}
			});
		}

		await this.tryFinalizeResponse(pendingRequest, message.content.requestId);
	}

	async handleResponseBufferChunk(message: WsMessage<WsServiceChunkMessage>) {
		const pendingRequest = this.pendingRequests[message.content.requestId];
		const idx = pendingRequest.pendingResponseBuffers!.findIndex(b => b.id === message.content.bufferOrStreamId);
		if (message.payload?.length) {
			pendingRequest.pendingResponseBuffers![idx].write(message.payload);
		}
		if (message.content.isLastChunk) {
			pendingRequest.pendingResponseBuffers!.splice(idx, 1);
		}
		await this.tryFinalizeResponse(pendingRequest, message.content.requestId);
	}

	async handleResponseStreamChunk(message: WsMessage<WsServiceChunkMessage>) {
		const requestId = message.content.requestId;
		// await this.responsePromises[requestId];
		const pendingRequest = this.pendingRequests[requestId];
		const ContentType = pendingRequest.request.constructor[responseTypeSymbol]?.[1];
		const stream: NaniumStream = pendingRequest.openResponseStreams!.find(b => b.id === message.content.bufferOrStreamId)!;
		if (!stream) {
			throw new Error('handleResponseStreamChunk: stream not found with id: ' + message.content.bufferOrStreamId);
		}
		if (
			(stream as any)[streamTypeSymbol] &&
			!NaniumBuffer.isNaniumBuffer((stream as any)[streamTypeSymbol])
		) {
			// DTO stream
			if (message.payload?.length) {
				const deserialized = this.config.serializer!.deserialize(message.payload);
				stream?.write(NaniumObject.create(deserialized, ContentType));
			}
		} else {
			stream?.write(message.payload);
			// binary stream
		}
		return Promise.resolve();
	}

	handleResponseStreamEnd(message: WsMessage<WsServiceChunkMessage>) {
		const requestId = message.content.requestId;
		// await this.responsePromises[requestId];
		// delete this.responsePromises[requestId];
		const pendingRequest = this.pendingRequests[requestId];
		if (!pendingRequest) {
			throw new Error('handleResponseStreamEnd: pending request not found with id ' + requestId);
		}
		this.removeStreamFromList(pendingRequest!.openResponseStreams, message.content.bufferOrStreamId);
		this.tryDisposePendingRequest(requestId);
	}

	removeStreamFromList(openResponseStreams: NaniumStream[] = [], bufferOrStreamId: string | undefined) {
		const idx = openResponseStreams!.findIndex((b) => b.id === bufferOrStreamId);
		openResponseStreams![idx].end();
		openResponseStreams!.splice(idx, 1);
	}

	tryDisposePendingRequest(requestId: string) {
		const pendingRequest = this.pendingRequests[requestId];
		if (
			!pendingRequest!.openResponseStreams!.length &&
			!pendingRequest!.pendingResponseBuffers?.length
		) {
			if (pendingRequest!.openRequestStreams?.length) {

				// maybe streams of request are closed later than streams in response
				// or response does not have any streams but the service returns the response immediately,
				// so on end of each request stream, try to dispose pending request to prevent memory leaks
				void (async () => {
					const stream = pendingRequest!.openRequestStreams![0];
					for await (const _chunk of stream) { ; }
					this.removeStreamFromList(pendingRequest!.openRequestStreams, stream.id);
				})();
			}
			delete this.pendingRequests[requestId];
		}
	}

	handleResponseStreamError(message: WsMessage<WsServiceChunkMessage>) {
		const requestId = message.content.requestId;
		// await this.responsePromises[requestId];
		// delete this.responsePromises[requestId];
		const pendingRequest = this.pendingRequests[message.content.requestId];
		if (!pendingRequest) {
			throw new Error('handleResponseStreamError: pending request not found with id ' + requestId);
		}
		this.removeStreamFromList(pendingRequest!.openResponseStreams, message.content.bufferOrStreamId);
		this.tryDisposePendingRequest(requestId);
	}

	async tryFinalizeResponse(pendingRequest: PendingRequestInfo<any>, requestId: string) {
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

		this.tryDisposePendingRequest(requestId);

		pendingRequest.resolve(pendingRequest.response);
	}
}

class PendingRequestInfo<T> {
	request: any;
	response?: any;
	resolve: ResolveFunction<T>;
	reject: RejectFunction;
	pendingResponseBuffers?: NaniumBuffer[];
	openResponseStreams?: NaniumStream[];
	openRequestStreams?: NaniumStream[];
}
