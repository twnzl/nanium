import { randomUUID } from 'crypto';
import * as multipart from 'parse-multipart-data';
import { Nanium } from '../../../core.js';
import { NaniumLogger } from '../../../interfaces/logger.js';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { NaniumObject, responseTypeSymbol } from '../../../objects.js';
import { NaniumJsonSerializer } from '../../../serializers/json.js';
import { getPrimaryResponseType, getSecondaryResponseType } from '../../core.js';
const LPR_TIMEOUT_MS = 3000;
export class NaniumHttpChannel {
    constructor(id, config) {
        this.id = id;
        this.onClientRemoved = [];
        this.longPollingResponses = {};
        this.lastLongPollingContact = {};
        this.pendingEvents = {};
        this.config = {
            ...{
                server: undefined,
                apiPath: config.apiPath?.toLowerCase() ?? '/api',
                eventPath: config.eventPath?.toLowerCase() ?? '/events',
                serializer: new NaniumJsonSerializer(),
                executionContextConstructor: Object,
                longPollingRequestTimeoutInSeconds: 30,
            },
            ...(config || {})
        };
    }
    getRootUrl(url) {
        let result = url.split('?')[0].split('#')[0]?.toLowerCase();
        if (result.endsWith('/')) {
            result = result.slice(0, -1);
        }
        return result;
    }
    async init(serviceRepository, manager) {
        this.serviceRepository = serviceRepository;
        this.manager = manager;
        const handleFunction = async (req, res, next) => {
            if (res.writableFinished) {
                return;
            }
            const url = this.getRootUrl(req['originalUrl'] || req.url);
            // event subscriptions
            if (url === this.config.eventPath) {
                await this.handleIncomingEventSubscription(req, res);
            }
            // event unsubscription
            else if (url === this.config.eventPath + '/delete') {
                await this.handleIncomingEventUnsubscription(req, res);
            }
            // service requests
            else if (req.method.toLowerCase() === 'post' && url === this.config.apiPath) {
                await this.handleIncomingServiceRequest(req, res);
            }
            // something different
            else if (next) {
                next();
            }
        };
        if (typeof this.config.server['use'] === 'function') { // express-like
            this.config.server['use'](handleFunction);
        }
        else {
            const server = this.config.server;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
            const listeners = server.listeners('request');
            if (listeners.length === 1 && typeof listeners[0]['use'] === 'function') { // http(s) server from express-like
                listeners[0]['use'](this.config.apiPath, handleFunction);
            }
            else { // pure http(s) server
                // if (typeof server.prependListener === 'function') {
                // 	server.prependListener('request', handleFunction);
                // }
                // else {
                server.addListener('request', handleFunction);
                // }
            }
        }
    }
    //#region service request handling
    async handleIncomingServiceRequest(req, res) {
        const data = [];
        await new Promise((resolve, reject) => {
            let deserialized;
            let request;
            const isMultipart = req.headers['content-type']?.startsWith('multipart/form-data');
            req.on('data', (chunk) => {
                data.push(chunk);
            }).on('end', async () => {
                try {
                    if (isMultipart) {
                        const body = Buffer.concat(data);
                        const boundary = req.headers['content-type'].replace('multipart/form-data; boundary=', '');
                        const parts = multipart.parse(body, boundary);
                        [request, deserialized] = await this.getMultipartResult(parts);
                    }
                    else {
                        const body = Buffer.concat(data).toString();
                        deserialized = this.config.serializer.deserialize(body);
                        request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
                    }
                    await this.process(request, req, res);
                    if (!NaniumStream.isNaniumStream(this.serviceRepository[deserialized.serviceName].Request[responseTypeSymbol]) &&
                        !NaniumStream.isNaniumStream(this.serviceRepository[deserialized.serviceName].Request[responseTypeSymbol]?.[0])) {
                        res.end();
                        resolve();
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    async getMultipartResult(parts) {
        const txt = parts.find(p => p.name === 'request').data.toString();
        const deserialized = this.config.serializer.deserialize(txt);
        const request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
        NaniumObject.forEachProperty(request, (name, parent, typeInfo) => {
            if ((typeInfo?.ctor && typeInfo?.ctor['naniumBufferInternalValueSymbol']) ||
                (parent[name[name.length - 1]]?.constructor && parent[name[name.length - 1]]?.constructor['naniumBufferInternalValueSymbol'])) {
                const binaryId = parent[name[name.length - 1]].id;
                parent[name[name.length - 1]].write(parts.find(p => p.name === binaryId).data);
            }
        });
        return [request, deserialized];
    }
    async process(request, req, res) {
        return await NaniumHttpChannel.processCore(this.config, this.serviceRepository, request, req, res);
    }
    static async processCore(config, serviceRepository, request, req, res) {
        const serviceName = request.constructor.serviceName;
        const ResponseType = getPrimaryResponseType(serviceRepository, serviceName);
        try {
            res.setHeader('Content-Type', config.serializer.mimeType);
            const executionContext = new config.executionContextConstructor({
                scope: 'public',
                source: this.getClientIp(req)
            });
            const result = await Nanium.execute(request, serviceName, executionContext);
            if (result !== undefined && result !== null) {
                if (NaniumBuffer.isNaniumBuffer(ResponseType)) {
                    res.write(await NaniumBuffer.as(Uint8Array, result));
                }
                else if (NaniumStream.isNaniumStream(ResponseType)) {
                    const stream = result;
                    try {
                        for await (const chunk of stream) {
                            if (NaniumBuffer.isNaniumBuffer(getSecondaryResponseType(serviceRepository, serviceName))) {
                                const canContinue = NaniumBuffer.isNaniumBuffer(chunk)
                                    ? res.write(await chunk.asUint8Array())
                                    : res.write(chunk);
                                if (!canContinue) { // Wait until HTTP response is ready to take more data
                                    await new Promise(resolve => res.once('drain', resolve));
                                }
                            }
                            else {
                                res.write(config.serializer.serializePartial(chunk));
                            }
                        }
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.write(config.serializer.serializePartial(err));
                    }
                    finally {
                        res.end();
                    }
                }
                else {
                    res.write(config.serializer.serialize(result));
                }
            }
            res.statusCode = 200;
        }
        catch (e) {
            res.statusCode = 500;
            let serialized;
            if (e instanceof Error) {
                serialized = config.serializer.serialize({
                    message: e.message,
                    // stack should not be sent out
                });
            }
            else {
                serialized = config.serializer.serialize(e);
            }
            res.write(serialized);
        }
    }
    static getClientIp(req) {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor && typeof forwardedFor === 'string') {
            return forwardedFor.split(',')[0].trim();
        }
        return req.socket.remoteAddress;
    }
    //#endregion service request handling
    //#region event handling
    async handleIncomingEventSubscription(req, res) {
        // request a unique clientId
        if (req.method.toLowerCase() === 'get') {
            NaniumLogger.info('channel http: incoming client ID request');
            res.statusCode = 200;
            const id = randomUUID();
            res.write(this.config.serializer.serialize(id));
            res.end();
            NaniumLogger.info('channel http: sent client ID: ', id);
        }
        // subscription
        else if (req.method.toLowerCase() === 'post') {
            await new Promise((resolve, reject) => {
                const data = [];
                req.on('data', (chunk) => {
                    data.push(chunk);
                }).on('end', async () => {
                    try {
                        // deserialize subscription info
                        const subscriptionData = this.config.serializer.deserialize(Buffer.concat(data).toString());
                        subscriptionData.channelId = this.id;
                        subscriptionData.source = NaniumHttpChannel.getClientIp(req);
                        //todo: create real instances of EventSubscription and additionalData  e.g:
                        // const subscriptionData: EventSubscription = NaniumObject.create(
                        // 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
                        // 	EventSubscription,
                        // 	{'TData': this.config.subscriptionDataConstructor}
                        // );
                        // store subscription information
                        if (subscriptionData.eventName) {
                            NaniumLogger.info('channel http: incoming event subscription: ', subscriptionData.eventName);
                            // ask the manager to execute interceptors and to decide if the subscription is accepted or not
                            try {
                                await Nanium.receiveSubscription(subscriptionData);
                            }
                            catch (e) {
                                res.statusCode = 400;
                                const responseBody = this.config.serializer.serialize(e);
                                res.write(responseBody);
                                res.end();
                                resolve();
                                return;
                            }
                            res.end();
                            resolve();
                        }
                        // use keep request open for the long polling mechanism
                        else {
                            NaniumLogger.info('channel http: new long-polling request from clientId: ', subscriptionData.clientId);
                            res.setTimeout(this.config.longPollingRequestTimeoutInSeconds * 1000, () => {
                                res.end();
                                NaniumLogger.info('channel http: long-polling request from clientId timed out: ', subscriptionData.clientId);
                                // todo: self cleaning: delete this.longPollingResponses[subscriptionData.clientId];
                            });
                            this.longPollingResponses[subscriptionData.clientId] = res;
                            this.lastLongPollingContact[subscriptionData.clientId] = Date.now();
                            if (Nanium.communicators?.length) {
                                for (const com of Nanium.communicators) {
                                    com.broadcast({ type: 'long_polling_response_received', clientId: subscriptionData.clientId }).then();
                                }
                            }
                            NaniumLogger.info('channel http: open long-polling requests from clientId ', subscriptionData.clientId);
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            });
        }
    }
    async handleIncomingEventUnsubscription(req, res) {
        if (req.method.toLowerCase() !== 'post') {
            return;
        }
        await new Promise((resolve, reject) => {
            const data = [];
            req.on('data', (chunk) => {
                data.push(chunk);
            }).on('end', async () => {
                try {
                    // deserialize subscription info
                    const subscriptionData = this.config.serializer.deserialize(Buffer.concat(data).toString());
                    subscriptionData.source = NaniumHttpChannel.getClientIp(req);
                    //todo: create real instances of EventSubscription and additionalData  e.g:
                    // const subscriptionData: EventSubscription = NaniumObject.create(
                    // 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
                    // 	EventSubscription,
                    // 	{'TData': this.config.subscriptionDataConstructor}
                    // );
                    await Nanium.unsubscribe(subscriptionData);
                    resolve();
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        res.statusCode = 200;
        res.end();
    }
    async emitEvent(event, subscription) {
        NaniumLogger.info('channel http: emitEvent: ', event, subscription);
        await this.emitEventCore(event, subscription);
        //todo: ### change response to boolean?
    }
    async emitEventCore(event, subscription, tryStart) {
        // try later if there is no open long-polling response (e.g. because of a recent event transmission)
        if (!this.longPollingResponses[subscription.clientId] || this.longPollingResponses[subscription.clientId].writableFinished) {
            NaniumLogger.info('channel http: emitEventCore: no open long-polling response');
            // if we've tried/waited enough
            if (tryStart && timeDiff(tryStart) > LPR_TIMEOUT_MS) {
                // if nobody had contact, or it is too long ago - remove client
                if (!this.lastLongPollingContact[subscription.clientId] ||
                    timeDiff(this.lastLongPollingContact[subscription.clientId]) > (LPR_TIMEOUT_MS * 2)
                // if anyone has connection to the client he would use the lpr to send this event,
                // so the client will start a new lpr request immediately and
                // so the last contact can not be much longer ago than the waiting time for the new lpr
                // if so - client has gone
                ) {
                    this.removeClient(subscription.clientId);
                    return;
                }
                return;
            }
            // else remember current event and try again later
            if (event) {
                this.pendingEvents[subscription.clientId] = this.pendingEvents[subscription.clientId] ?? [];
                this.pendingEvents[subscription.clientId].push({ event, eventName: subscription.eventName });
            }
            tryStart = tryStart ?? Date.now();
            return new Promise((resolve, reject) => {
                setTimeout(async () => {
                    resolve(await this.emitEventCore(undefined, subscription, tryStart));
                }, 500);
            });
        }
        // else, transmit the data and end the long-polling request
        else {
            NaniumLogger.info('channel http: emitEventCore: transmit the data and end the long-polling request');
            try {
                let responseBody;
                // if events are waiting for an open long-polling-request send them together with the current event as array
                if (this.pendingEvents[subscription.clientId]?.length) {
                    if (event) {
                        this.pendingEvents[subscription.clientId].push({ eventName: subscription.eventName, event });
                    }
                    responseBody = this.config.serializer.serialize(this.pendingEvents[subscription.clientId]);
                }
                else {
                    responseBody = this.config.serializer.serialize({ eventName: subscription.eventName, event });
                }
                this.longPollingResponses[subscription.clientId].setHeader('Content-Type', 'application/json; charset=utf-8');
                this.longPollingResponses[subscription.clientId].statusCode = 200;
                this.longPollingResponses[subscription.clientId].write(responseBody);
                this.longPollingResponses[subscription.clientId].end();
                delete this.longPollingResponses[subscription.clientId];
                delete this.pendingEvents[subscription.clientId];
            }
            catch (e) {
                NaniumLogger.error('emitEventCore', e);
            }
            return false;
        }
    }
    receiveCommunicatorMessage(msg) {
        if (msg.type === 'event_subscribe') {
            const eventMessage = msg;
            void Nanium.receiveSubscription(eventMessage.data, false);
        }
        else if (msg.type === 'event_unsubscribe') {
            const eventMessage = msg;
            void Nanium.unsubscribe(eventMessage.data, undefined, false);
        }
        else if (msg.type === 'remove_client') {
            const eventMessage = msg;
            void Nanium.removeClient(eventMessage.data, false);
        }
        else if (msg.type === 'generic') {
            const message = msg.data;
            if (message.type === 'long_polling_response_received') {
                this.lastLongPollingContact[message.clientId] = Date.now();
            }
        }
    }
    ;
    removeClient(clientId) {
        delete this.longPollingResponses[clientId];
        delete this.pendingEvents[clientId];
        delete this.lastLongPollingContact[clientId];
        for (const handler of this.onClientRemoved) {
            handler(clientId);
        }
        Nanium.removeClient(clientId).then();
    }
}
class CommunicatorMessage {
}
function timeDiff(timestamp) {
    return Date.now() - timestamp;
}
//# sourceMappingURL=http.js.map