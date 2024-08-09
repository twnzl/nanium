export interface WsMessage<T = any> {
	type: 'subscribe_event' | 'unsubscribe_event' | 'emit_event',
	content: T,
}
