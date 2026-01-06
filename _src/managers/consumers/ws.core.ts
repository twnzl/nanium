import { AsyncHelper, ExtendedPromise } from '../../helper';

type WebSocketType = WebSocket | import('ws');

export class WebSocketClient {
	connected: ExtendedPromise<void>;
	reconnectInterval: number;
	maxBufferSize: number = 1024 * 1024; // 1Mb

	private socket: WebSocketType | null = null;
	private eventHandler: { [eventName: string]: Function[] } = {};
	private readonly url: string;
	private closedOnPurpose: boolean;

	constructor(url: string, reconnectInterval: number = 1000) {
		this.url = url;
		this.reconnectInterval = reconnectInterval;
	}

	async connect(): Promise<void> {
		this.connected = new ExtendedPromise<void>();

		if (typeof window !== 'undefined' && window.WebSocket) {
			// Browser environment
			this.socket = new WebSocket(this.url);
		} else {
			// Node.js environment
			const WebSocket = await import('ws');
			this.socket = new WebSocket(this.url);
		}

		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onclose = this.onClose.bind(this);
		this.socket.onerror = this.onError.bind(this);

		return this.connected;
	}

	close(): void {
		this.closedOnPurpose = true;
		this.socket.close();
		this.connected?.reject();
	}

	async send(data: string | ArrayBuffer | ArrayBufferView): Promise<void> {
		if (this.socket && this.socket.readyState === (WebSocket as any).OPEN) {
			this.socket.send(data);
			while (this.socket.bufferedAmount > this.maxBufferSize) {
				await AsyncHelper.pause(10); // Wait if buffer is too full
			}
		} else {
			throw new Error('WebSocket is not open. Unable to send message.');
		}
	}

	on(eventType: 'open' | 'close' | 'message' | 'error', handler: (event: any) => void): void {
		this.eventHandler[eventType] ??= [];
		this.eventHandler[eventType].push(handler);
	}

	private onOpen(event: Event): void {
		for (const handler of this.eventHandler['open'] ?? []) {
			handler(event);
		}
		this.connected?.resolve();
	}

	private onMessage(event: MessageEvent): void {
		for (const handler of this.eventHandler['message'] ?? []) {
			handler(event);
		}
	}

	private onClose(event: CloseEvent): void {
		if (!this.closedOnPurpose) {
			// reconnect
			setTimeout(() => this.connect(), this.reconnectInterval);
		}
		for (const handler of this.eventHandler['close'] ?? []) {
			handler(event);
		}
	}

	private onError(event: Event): void {
		for (const handler of this.eventHandler['error'] ?? []) {
			handler(event);
		}
	}
}
