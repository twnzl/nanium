import { NaniumObject, Type } from '../../../objects';

export type WsMessageType = 'subscribe_event' | 'unsubscribe_event' | 'emit_event' |
	'subscription_result' | 'unsubscription_result' | 'service_request' | 'service_response';

export class WsMessage<TContent = any> extends NaniumObject<WsMessage<TContent>> {
	@Type(String) type: WsMessageType;
	@Type('TContent') content: TContent;
}

export class EmitEventMessageContent extends NaniumObject<EmitEventMessageContent> {
	@Type(String) eventName: string;
	@Type(Object) event: any;
}

export class SubscribeEventmessageContent extends NaniumObject<SubscribeEventmessageContent> {
	@Type(String) eventName: string;
	@Type(Object) error?: any;
}

export class WsServiceRequestMessage extends NaniumObject<WsServiceRequestMessage> {
	@Type(String) id: string;
	@Type(String) serviceName: string;
	@Type(Object) request: any;
}

export class WsServiceResponseMessage extends NaniumObject<WsServiceResponseMessage> {
	@Type(String) id: string;
	@Type(String) error?: string;
	@Type(Object) response?: any;
}
