import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import WebSocket from 'ws';
import { Channel } from '../../../interfaces/channel.js';
import { ChannelConfig } from '../../../interfaces/channelConfig.js';
import { EventSubscription } from '../../../interfaces/eventSubscription.js';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager.js';
import { NaniumRepository } from '../../../interfaces/serviceRepository.js';
import { WsMessage, WsServiceChunkMessage, WsServiceRequestMessage } from './ws.types.js';
export interface NaniumWebsocketChannelConfig extends ChannelConfig {
    server: HttpServer | HttpsServer;
    binaryChunkSize?: number;
    maxBufferSize?: number;
    streamAndBufferTimeout?: number;
}
export declare class NaniumWebsocketChannel implements Channel {
    id: string;
    manager: ServiceProviderManager;
    onClientRemoved: ((clientId: string) => void)[];
    private readonly config;
    private wss;
    private clientSubscriptionInfo;
    private serviceRepository;
    private parseMessageMutex;
    private arrivingRequests;
    private openRequestStreams;
    constructor(id: string, config: NaniumWebsocketChannelConfig);
    send(ws: WebSocket, data: string | ArrayBuffer | Uint8Array): Promise<void>;
    init(serviceRepository: NaniumRepository, _manager: ServiceProviderManager): Promise<void>;
    terminate(): Promise<void>;
    getClientIp(req: IncomingMessage): string;
    removeClient?(clientId: string): void;
    private handleIncomingMessage;
    handleIncomingServiceRequest(message: WsMessage<WsServiceRequestMessage>, ws: WebSocket): Promise<any>;
    handleIncomingServiceRequestBufferChunk(message: WsMessage<WsServiceChunkMessage>, ws: WebSocket): Promise<any>;
    handleIncomingServiceRequestStreamChunk(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket): any;
    handleIncomingServiceRequestStreamEnd(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket): void;
    handleIncomingServiceRequestStreamError(message: WsMessage<WsServiceChunkMessage>, _ws: WebSocket): void;
    private handleIncomingEventSubscription;
    private handleIncomingEventUnsubscription;
    emitEvent(event: any, subscription?: EventSubscription): Promise<void>;
}
