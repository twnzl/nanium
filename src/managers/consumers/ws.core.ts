import { AsyncHelper, ExtendedPromise } from '../../helper.js';

/**
 * Minimal event shapes shared by the browser WebSocket and the node.js 'ws' package,
 * so that this file does not depend on the DOM lib.
 */
export interface WebSocketEvent {
	readonly type: string;
}

export interface WebSocketMessageEvent extends WebSocketEvent {
	readonly data: any;
}

export interface WebSocketCloseEvent extends WebSocketEvent {
	readonly code: number;
	readonly reason: string;
	readonly wasClean: boolean;
}

/** value of readyState when the connection is open (same in browser and node 'ws') */
const WEBSOCKET_OPEN = 1;

/** abstraction of the browser WebSocket and the node.js 'ws' WebSocket */
export interface WebSocketType {
	readonly readyState: number;
	readonly bufferedAmount: number;
	onopen: ((event: WebSocketEvent) => void) | null;
	onmessage: ((event: WebSocketMessageEvent) => void) | null;
	onclose: ((event: WebSocketCloseEvent) => void) | null;
	onerror: ((event: WebSocketEvent) => void) | null;
	close(): void;
	send(data: string | ArrayBuffer | ArrayBufferView): void;
}

export class WebSocketClient {
	connected: ExtendedPromise<void>;
	reconnectInterval: number;
	maxBufferSize: number = 1024 * 1024; // 1Mb

	private socket?: WebSocketType;
	private eventHandler: { [eventName: string]: ((event: any) => void)[] } = {};
	private readonly url: string;
	private closedOnPurpose: boolean;

	constructor(private socketFactory: () => Promise<WebSocketType>, reconnectInterval: number = 1000) {
		this.reconnectInterval = reconnectInterval;
		this.connected = new ExtendedPromise<void>();
	}

	async connect(): Promise<void> {
		this.socket ??= await this.socketFactory();
		if (this.connected.isResolved) {
			if (this.socket.readyState === WEBSOCKET_OPEN) {
				return this.connected;
			}
			this.connected.cancel();
			this.connected = new ExtendedPromise();
		}
		// if (typeof window !== 'undefined' && window.WebSocket) {
		// 	// Browser environment
		// 	this.socket = new WebSocket(this.url);
		// } else {
		// 	// Node.js environment
		// 	const { default: NodeWebSocket } = await import('ws');
		// 	this.socket = new NodeWebSocket(this.url);
		// }

		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onclose = this.onClose.bind(this);
		this.socket.onerror = this.onError.bind(this);

		return this.connected;
	}

	close(): void {
		try {
		//debugger;
			this.closedOnPurpose = true;
			this.socket?.close();
			this.connected?.reject();
		} catch (err) {
			console.error('Error while closing WebSocket:', err);
		}
	}

	async send(data: string | ArrayBuffer | ArrayBufferView): Promise<void> {
		if (!this.socket || !this.connected) {
			throw new Error('WebSocket not connected.');
		}
		await this.connected;
		if (this.socket.readyState !== WEBSOCKET_OPEN) {
			throw new Error('WebSocket is not open.');
		}
		this.socket.send(data);
		while (this.socket.bufferedAmount > this.maxBufferSize) {
			await AsyncHelper.pause(10); // Wait if buffer is too full
		}
	}

	on(eventType: 'open' | 'close' | 'message' | 'error', handler: (event: any) => void): void {
		this.eventHandler[eventType] ??= [];
		this.eventHandler[eventType].push(handler);
	}

	private onOpen(event: WebSocketEvent): void {
		for (const handler of this.eventHandler['open'] ?? []) {
			handler(event);
		}
		this.connected?.resolve();
	}

	private onMessage(event: WebSocketMessageEvent): void {
		for (const handler of this.eventHandler['message'] ?? []) {
			handler(event);
		}
	}

	private onClose(event: WebSocketCloseEvent): void {
		if (!this.closedOnPurpose) {
			// reconnect
			setTimeout(() => this.connect(), this.reconnectInterval);
		}
		for (const handler of this.eventHandler['close'] ?? []) {
			handler(event);
		}
	}

	private onError(event: WebSocketEvent): void {
		for (const handler of this.eventHandler['error'] ?? []) {
			handler(event);
		}
	}
}
