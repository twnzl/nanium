import { WebSocketType } from './ws.core.js';
import { ConsumerWebsocketBase, NaniumConsumerWebsocketConfigBase } from './wsBase.js';

export interface NaniumConsumerNodeWebsocketConfig extends NaniumConsumerWebsocketConfigBase {
}

/**
 * websocket consumer for use in node.js processes (e.g. a remote micro-service that consumes services of another
 * nanium process via websocket, like NaniumConsumerBrowserWebsocket does from within a browser).
 * It communicates with a NaniumWebsocketChannel on the server side using the same protocol as the browser
 * implementation, the only difference is how the connectUrl is determined, because there is no window object here.
 */
export class NaniumConsumerNodeWebsocket extends ConsumerWebsocketBase<NaniumConsumerNodeWebsocketConfig> {

	constructor(config: NaniumConsumerNodeWebsocketConfig) {
		super(async () => {
			const { default: NodeWebSocket } = await import('ws');
			return new NodeWebSocket(config.connectUrl ?? '') as unknown as WebSocketType;
		}, config);
	}

	init(): Promise<void> {
		if (!this.config.connectUrl?.startsWith('ws://') && !this.config.connectUrl?.startsWith('wss://')) {
			throw new Error('NaniumConsumerNodeWebsocket: config.connectUrl must be a full websocket url (ws:// or wss://)');
		}
		return Promise.resolve();
	}
}
