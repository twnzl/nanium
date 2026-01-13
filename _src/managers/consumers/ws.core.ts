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
		this.connected = new ExtendedPromise<void>();
	}

	async connect(): Promise<void> {
		if (this.connected.isResolved) {
			if (this.socket.readyState === (WebSocket as any).OPEN) {
				return this.connected;
			}
			this.connected.cancel();
			this.connected = new ExtendedPromise();
		}
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
		try {
		//debugger;
			this.closedOnPurpose = true;
			this.socket.close();
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
		if (this.socket.readyState !== (WebSocket as any).OPEN) {
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
