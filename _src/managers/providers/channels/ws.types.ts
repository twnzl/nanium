import { NaniumObject, Type } from '../../../objects';

export type WsMessageType = 'subscribe_event' | 'unsubscribe_event' | 'emit_event'
	| 'subscription_result' | 'unsubscription_result' | 'service_request' | 'service_response'
	| 'service_buffer_chunk'
	| 'service_stream_chunk' | 'service_stream_error' | 'service_stream_end';

export class WsMessage<TContent = any> extends NaniumObject<WsMessage<TContent>> {
	@Type(String) type: WsMessageType;
	@Type('TContent') content: TContent;
	@Type(Object) payload?: ArrayBuffer;
	@Type(Object) error?: any;
}

export class EmitEventMessageContent extends NaniumObject<EmitEventMessageContent> {
	@Type(String) eventName: string;
	@Type(Object) event: any;
}

export class SubscribeEventmessageContent extends NaniumObject<SubscribeEventmessageContent> {
	@Type(String) eventName: string;
}

export class WsServiceRequestMessage extends NaniumObject<WsServiceRequestMessage> {
	@Type(String) id: string;
	@Type(String) serviceName: string;
	@Type(Object) request: any;
}

export class WsServiceChunkMessage extends NaniumObject<WsServiceChunkMessage> {
	@Type(String) requestId: string;
	@Type(Object) response?: any;
	@Type(String) bufferOrStreamId?: string;
	@Type(Boolean) isLastChunk?: boolean;
	@Type(Number) totalBytes?: number;
}
