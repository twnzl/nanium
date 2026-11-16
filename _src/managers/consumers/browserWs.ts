import { ConsumerWebsocketBase, NaniumConsumerWebsocketConfigBase } from './wsBase.js';

export interface NaniumConsumerBrowserWebsocketConfig extends NaniumConsumerWebsocketConfigBase {
}

export class NaniumConsumerBrowserWebsocket extends ConsumerWebsocketBase<NaniumConsumerBrowserWebsocketConfig> {
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
