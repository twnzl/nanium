import { NaniumObject } from '../../../objects.js';
export type WsMessageType = 'subscribe_event' | 'unsubscribe_event' | 'emit_event' | 'subscription_result' | 'unsubscription_result' | 'service_request' | 'service_response' | 'service_buffer_chunk' | 'service_stream_chunk' | 'service_stream_error' | 'service_stream_end';
export declare class WsMessage<TContent = any> extends NaniumObject<WsMessage<TContent>> {
    type: WsMessageType | 'unknown';
    content: TContent;
    payload?: Uint8Array;
    error?: any;
}
export declare class EmitEventMessageContent extends NaniumObject<EmitEventMessageContent> {
    eventName: string;
    event: any;
}
export declare class SubscribeEventMessageContent extends NaniumObject<SubscribeEventMessageContent> {
    eventName: string;
}
export declare class WsServiceRequestMessage extends NaniumObject<WsServiceRequestMessage> {
    id: string;
    serviceName: string;
    request: any;
}
export declare class WsServiceChunkMessage extends NaniumObject<WsServiceChunkMessage> {
    requestId: string;
    response?: any;
    bufferOrStreamId?: string;
    isLastChunk?: boolean;
    totalBytes?: number;
}
