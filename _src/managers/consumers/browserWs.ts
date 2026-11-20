import { WebSocketType } from './ws.core.js';
import { ConsumerWebsocketBase, NaniumConsumerWebsocketConfigBase } from './wsBase.js';

export interface NaniumConsumerBrowserWebsocketConfig extends NaniumConsumerWebsocketConfigBase {
}

export class NaniumConsumerBrowserWebsocket extends ConsumerWebsocketBase<NaniumConsumerBrowserWebsocketConfig> {

	constructor(config: NaniumConsumerBrowserWebsocketConfig) {
		super(() => Promise.resolve(new WebSocket(config.connectUrl ?? '') as unknown as WebSocketType), config);
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
}
