import { WebSocketServer } from 'ws';
import { Nanium } from '../../../core.js';
import { AsyncHelper, criticalSection, Mutex, setExtendedTimeout } from '../../../helper.js';
import { NaniumLogger } from '../../../interfaces/logger.js';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { genericTypesSymbol, NaniumObject } from '../../../objects.js';
import { NaniumJsonSerializer } from '../../../serializers/json.js';
import { getPrimaryResponseType, getSecondaryResponseType } from '../../core.js';
import { initStream, parseMessage, sendBufferInChunks, sendMessage } from '../../ws.core.js';
import { SubscribeEventMessageContent, WsMessage } from './ws.types.js';
const clientIdSymbol = Symbol.for('__client_id__');
const sourceSymbol = Symbol.for('__source__');
const hasBuffersSymbol = Symbol.for('__has_buffers__');
const hasStreamsSymbol = Symbol.for('__has_streams__');
export class NaniumWebsocketChannel {
    // private openResponseStreams: Map<string, {
    // 	type: NaniumPropertyInfoCore,
    // 	stream?: NaniumStream,
    // }> = new Map();
    constructor(id, config) {
        this.id = id;
        this.onClientRemoved = [];
        this.clientSubscriptionInfo = new Map(); // first client ID
        this.parseMessageMutex = new Mutex();
        this.arrivingRequests = new Map();
        this.openRequestStreams = new Map();
        this.config = {
            ...{
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
    async send(ws, data) {
        ws.send(data);
        while (ws.bufferedAmount > this.config.maxBufferSize) {
            await AsyncHelper.pause(10); // Wait if buffer is too full
        }
    }
    init(serviceRepository, _manager) {
        this.serviceRepository = serviceRepository;
        this.wss = new WebSocketServer({ server: this.config.server });
        this.wss.on('connection', (ws, req) => {
            ws[sourceSymbol] = this.getClientIp(req);
            // Handle messages from the client
            ws.on('message', (rawMessage) => {
                try {
                    void this.handleIncomingMessage(rawMessage, ws);
                }
                catch (e) {
                    void sendMessage({
                        type: 'service_response',
                        error: e,
                        content: null
                    }, this.config.serializer, async (data) => await this.send(ws, data));
                }
            });
            // Handle client disconnection
            ws.on('close', () => {
                // remove subscriptions of this socket
                this.removeClient(ws[clientIdSymbol]);
            });
            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                throw error;
            });
        });
        return Promise.resolve();
    }
    terminate() {
        const perClient = this.clientSubscriptionInfo.values();
        for (const clientSubscription of perClient) {
            clientSubscription.websocket.terminate();
        }
        this.clientSubscriptionInfo = new Map();
        return Promise.resolve();
    }
    ;
    getClientIp(req) {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor && typeof forwardedFor === 'string') {
            return forwardedFor.split(',')[0].trim();
        }
        return req.socket.remoteAddress;
    }
    removeClient(clientId) {
        if (clientId) {
            this.clientSubscriptionInfo.delete(clientId);
            for (const handler of this.onClientRemoved) {
                handler(clientId);
            }
        }
    }
    async handleIncomingMessage(rawMessage, ws) {
        let message = new WsMessage();
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
            case 'service_stream_end':
                return this.handleIncomingServiceRequestStreamEnd(message, ws);
            case 'service_stream_error':
                return this.handleIncomingServiceRequestStreamError(message, ws);
            default:
                NaniumLogger.error(message.error ?? 'unknown ws message');
        }
    }
    //#region service request handling
    async handleIncomingServiceRequest(message, ws) {
        const serviceName = message.content.serviceName;
        const ResponseType = getPrimaryResponseType(this.serviceRepository, serviceName);
        const SubType = getSecondaryResponseType(this.serviceRepository, serviceName);
        try {
            const request = NaniumObject.create(message.content.request, this.serviceRepository[serviceName].Request);
            // buffers in request
            const buffers = [];
            NaniumObject.forEachProperty(request, (name, parent, typeInfo) => {
                if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
                    const prop = name[name.length - 1];
                    buffers.push(parent[prop]);
                }
            });
            if (buffers?.length) {
                this.arrivingRequests.set(message.content.id, { request, buffers });
                await new Promise((resolve, reject) => {
                    const ar = this.arrivingRequests.get(message.content.id);
                    if (ar === undefined) {
                        throw new Error('arrivingRequests not found');
                    }
                    ar.resolve = resolve;
                    ar.reject = reject;
                    ar.timeout = setExtendedTimeout(() => {
                        // close/cleanup buffers if not used for a while
                        ar.reject(new Error('buffer timeout'));
                        this.arrivingRequests.delete(message.content.id);
                    }, this.config.streamAndBufferTimeout);
                    // handleIncomingServiceRequestBufferChunk will resolve this when all request data arrived
                });
            }
            // streams in request
            NaniumObject.forEachProperty(request, (name, parent, typeInfo) => {
                if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
                    if (!typeInfo.localGenerics) {
                        throw new Error('no type of NaniumStream given: ' + request.constructor.name + name.join('.'));
                    }
                    const prop = name[name.length - 1];
                    const stream = parent[prop];
                    if (stream) {
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
            console.error('SERVER DEBUG before Nanium.execute', serviceName);
            const result = await Nanium.execute(request, serviceName, executionContext);
            console.error('SERVER DEBUG after Nanium.execute', serviceName, JSON.stringify(result));
            // buffer response
            if (NaniumBuffer.isNaniumBuffer(ResponseType)) {
                const responseMessage = {
                    type: 'service_response',
                    content: {
                        requestId: message.content.id,
                        response: result ? new NaniumBuffer(undefined, result.id) : undefined
                    }
                };
                await sendMessage(responseMessage, this.config.serializer, async (data) => this.send(ws, data));
                if (result) {
                    await sendBufferInChunks(result, message.content.id, async (data) => this.send(ws, data), 'service_buffer_chunk', this.config.serializer, this.config.binaryChunkSize);
                }
            }
            // stream response
            else if (NaniumStream.isNaniumStream(ResponseType)) {
                const responseMessage = {
                    type: 'service_response',
                    content: {
                        requestId: message.content.id,
                        response: result ? new NaniumStream() : undefined
                    }
                };
                responseMessage.content.response.id = result.id;
                await sendMessage(responseMessage, this.config.serializer, async (data) => ws.send(data));
                if (result) {
                    // this.openResponseStreams.set(result.id, { stream: result, type: typeInfo });
                    initStream(result, SubType ?? NaniumBuffer, message.content.id, async (data) => this.send(ws, data), this.config.serializer, this.config.binaryChunkSize);
                }
            }
            // normal response
            else {
                let hasGenericBuffers;
                let hasGenericStreams;
                if (ResponseType?.[genericTypesSymbol]) {
                    hasGenericBuffers = Object.values(ResponseType[genericTypesSymbol]).some((t) => NaniumBuffer.isNaniumBuffer(t));
                    hasGenericStreams = Object.values(ResponseType[genericTypesSymbol]).some((t) => NaniumStream.isNaniumStream(t));
                }
                // does response type contain buffers or Streams?
                if (ResponseType?.[hasBuffersSymbol] === undefined || ResponseType[hasStreamsSymbol] === undefined) {
                    NaniumObject.traverseType(ResponseType, (name, info) => {
                        if (NaniumBuffer.isNaniumBuffer(info.ctor)) {
                            ResponseType[hasBuffersSymbol] = true;
                        }
                        if (NaniumStream.isNaniumStream(info.ctor)) {
                            ResponseType[hasStreamsSymbol] = true;
                        }
                    });
                }
                // buffers inside response object
                const resBuffers = [];
                if (ResponseType?.[hasBuffersSymbol] || hasGenericBuffers) {
                    NaniumObject.forEachProperty(result, (name, parent, typeInfo) => {
                        if (typeInfo && NaniumBuffer.isNaniumBuffer(typeInfo.ctor)) {
                            const prop = name[name.length - 1];
                            if (parent[prop]) {
                                resBuffers.push(parent[prop]);
                                parent[prop] = new NaniumBuffer(undefined, parent[prop].id); // replace with buffer that only holds the id, not the data to send only this in the answer request
                            }
                        }
                    });
                }
                // streams inside response object
                if (ResponseType?.[hasStreamsSymbol] || hasGenericStreams) {
                    NaniumObject.forEachProperty(result, (name, parent, typeInfo) => {
                        if (typeInfo && NaniumStream.isNaniumStream(typeInfo.ctor)) {
                            const prop = name[name.length - 1];
                            if (parent[prop]) {
                                const stream = parent[prop];
                                // this.openResponseStreams.set(stream.id, { stream, type: typeInfo });
                                // todo: set timeouts to close/cleanup streams if not used for a while
                                initStream(stream, typeInfo.localGenerics, message.content.id, async (data) => this.send(ws, data), this.config.serializer, this.config.binaryChunkSize);
                            }
                        }
                    });
                }
                // send basic response
                const responseMessage = {
                    type: 'service_response',
                    content: {
                        requestId: message.content.id,
                        response: result
                    }
                };
                console.error('SERVER DEBUG resBuffers.length=', resBuffers.length, 'sending service_response');
                await sendMessage(responseMessage, this.config.serializer, async (data) => this.send(ws, data));
                console.error('SERVER DEBUG service_response sent');
                // send buffer chunks
                for (const buffer of resBuffers) {
                    console.error('SERVER DEBUG sending resBuffer', buffer.id, buffer.length);
                    await sendBufferInChunks(buffer, responseMessage.content.requestId, async (data) => this.send(ws, data), 'service_buffer_chunk', this.config.serializer, this.config.binaryChunkSize);
                    console.error('SERVER DEBUG resBuffer sent', buffer.id);
                }
            }
        }
        catch (e) {
            const responseMessage = {
                type: 'service_response',
                error: e instanceof Error ? e.message : e,
                content: {
                    requestId: message.content.id,
                }
            };
            await sendMessage(responseMessage, this.config.serializer, async (data) => this.send(ws, data));
        }
    }
    async handleIncomingServiceRequestBufferChunk(message, ws) {
        console.error('SERVER DEBUG handleIncomingServiceRequestBufferChunk', message.content.requestId, message.content.bufferOrStreamId, message.content.isLastChunk, message.payload?.length);
        try {
            const arrivingRequest = this.arrivingRequests.get(message.content.requestId);
            if (!arrivingRequest) {
                return; // bad message or request already timed out and removed
            }
            arrivingRequest.timeout?.restart();
            const buffer = arrivingRequest.buffers?.find(b => b.id === message.content.bufferOrStreamId);
            if (!buffer) {
                arrivingRequest.reject(new Error('buffer not found: ' + message.content.bufferOrStreamId + ' in request ' + message.content.requestId));
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
        }
        catch (e) {
            const responseMessage = {
                type: 'service_response',
                error: e instanceof Error ? e.message : e,
                content: message.content
            };
            await sendMessage(responseMessage, this.config.serializer, async (data) => this.send(ws, data));
        }
    }
    handleIncomingServiceRequestStreamChunk(message, _ws) {
        const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
        if (!streamInfo) {
            return; // bad message or already timed out and removed
        }
        streamInfo.timeout?.restart();
        if (NaniumBuffer.isNaniumBuffer(streamInfo.type.localGenerics)) { // binary
            streamInfo.stream.write(message.payload instanceof NaniumBuffer ? message.payload : new NaniumBuffer(message.payload));
        }
        else { // objects
            const deserialized = this.config.serializer.deserialize(message.payload);
            const obj = NaniumObject.create(deserialized, streamInfo.type.localGenerics);
            streamInfo.stream.write(obj);
        }
    }
    handleIncomingServiceRequestStreamEnd(message, _ws) {
        const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
        if (!streamInfo) {
            return; // bad message or already timed out and removed
        }
        streamInfo.timeout.cancel();
        streamInfo.stream.end();
        this.openRequestStreams.delete(message.content.bufferOrStreamId);
    }
    handleIncomingServiceRequestStreamError(message, _ws) {
        const streamInfo = this.openRequestStreams.get(message.content.bufferOrStreamId);
        if (!streamInfo) {
            return; // bad message or already timed out and removed
        }
        streamInfo.stream.error(message.error);
        this.openRequestStreams.delete(message.content.bufferOrStreamId);
    }
    //#endregion service request handling
    //#region event handling
    async handleIncomingEventSubscription(message, ws) {
        NaniumLogger.info('channel ws: incoming event subscription: ', message.content.eventName);
        // ask the manager to execute interceptors and to decide if the subscription is accepted or not
        const subscription = message?.content;
        let error;
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
                NaniumLogger.info(`duplicate event subscription: eventName=${subscription.eventName}, clientId = ${subscription.clientId}`);
            }
            else {
                subscriptionsOfClient.eventNames.add(subscription.eventName);
            }
        }
        catch (e) {
            error = e;
        }
        finally {
            const message = new WsMessage({
                type: 'subscription_result',
                error: error,
                content: {
                    eventName: subscription.eventName,
                }
            }, { 'TContent': SubscribeEventMessageContent });
            try {
                await sendMessage(message, this.config.serializer, async (data) => this.send(ws, data));
            }
            catch (e) {
                console.error('channel ws: send subscription result error: ', e.message, e.stack);
            }
        }
    }
    async handleIncomingEventUnsubscription(message, ws) {
        NaniumLogger.info('channel ws: incoming event unsubscription: ', message.content.eventName);
        let error;
        let clientSubscription;
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
        }
        catch (e) {
            error = e;
        }
        finally {
            const response = new WsMessage({
                type: 'unsubscription_result',
                error: error,
                content: {
                    eventName: message.content.eventName,
                }
            }, { 'TContent': SubscribeEventMessageContent });
            await sendMessage(response, this.config.serializer, async (data) => this.send(ws, data));
            // close websocket if no other subscriptions exist.
            if (!clientSubscription?.eventNames?.size) {
                clientSubscription.websocket?.close();
                this.clientSubscriptionInfo.delete(message.content.clientId);
            }
        }
    }
    async emitEvent(event, subscription) {
        const message = {
            type: 'emit_event',
            content: {
                eventName: event.constructor.eventName ?? subscription?.eventName,
                event
            }
        };
        const clientSubscription = this.clientSubscriptionInfo.get(subscription.clientId);
        try {
            if (clientSubscription?.eventNames?.has(message.content.eventName)) {
                await sendMessage(message, this.config.serializer, async (data) => this.send(clientSubscription.websocket, data));
            }
        }
        catch (e) {
            NaniumLogger.error('websocket channel: emitEvent: ', e.message, e.stack);
        }
    }
}
class ClientSubscriptionInfo {
    constructor(websocket) {
        this.websocket = websocket;
        this.eventNames = new Set();
    }
}
//# sourceMappingURL=ws.js.map