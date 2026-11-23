import { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';
import { Channel } from '../../../interfaces/channel.js';
import { ChannelConfig } from '../../../interfaces/channelConfig.js';
import { Message } from '../../../interfaces/communicator.js';
import { EventSubscription } from '../../../interfaces/eventSubscription.js';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager.js';
import { NaniumRepository } from '../../../interfaces/serviceRepository.js';
export interface NaniumHttpChannelConfig extends ChannelConfig {
    server: HttpServer | HttpsServer | {
        use: Function;
    };
    apiPath?: string;
    eventPath?: string;
    longPollingRequestTimeoutInSeconds?: number;
}
export declare class NaniumHttpChannel implements Channel {
    id: string;
    manager: ServiceProviderManager;
    onClientRemoved: ((clientId: any) => void)[];
    private readonly config;
    private serviceRepository;
    private longPollingResponses;
    private lastLongPollingContact;
    private pendingEvents;
    constructor(id: string, config: NaniumHttpChannelConfig);
    private getRootUrl;
    init(serviceRepository: NaniumRepository, manager: ServiceProviderManager): Promise<void>;
    private handleIncomingServiceRequest;
    getMultipartResult(parts: any[]): Promise<any[]>;
    process(request: any, req: IncomingMessage, res: ServerResponse): Promise<any>;
    static processCore(config: ChannelConfig, serviceRepository: NaniumRepository, request: any, req: IncomingMessage, res: ServerResponse): Promise<any>;
    static getClientIp(req: IncomingMessage): string;
    private handleIncomingEventSubscription;
    private handleIncomingEventUnsubscription;
    emitEvent(event: any, subscription?: EventSubscription): Promise<void>;
    emitEventCore(event: any, subscription: EventSubscription, tryStart?: number): Promise<boolean>;
    receiveCommunicatorMessage(msg: Message): void;
    removeClient?(clientId: string): void;
}
