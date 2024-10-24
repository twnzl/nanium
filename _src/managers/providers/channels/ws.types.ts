import { NaniumObject, Type } from '../../../objects';

export type WsMessageType = 'subscribe_event' | 'unsubscribe_event' | 'emit_event' |
	'subscription_result' | 'unsubscription_result';

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
