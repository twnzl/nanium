type WebSocketType = WebSocket | import('ws');

export class WebSocketClient {
	connected: Promise<void>;
	reconnectInterval: number;

	private socket: WebSocketType | null = null;
	private eventHandler: { [eventName: string]: Function[] } = {};
	private readonly url: string;
	private connectedResolve: Function;
	private closedOnPurpose: boolean;

	constructor(url: string, reconnectInterval: number = 1000) {
		this.url = url;
		this.reconnectInterval = reconnectInterval;
	}

	connect(): void {
		this.connected = new Promise<void>((resolve: Function, _reject: Function) => {
			this.connectedResolve = resolve;
		});

		if (typeof window !== 'undefined' && window.WebSocket) {
			// Browser environment
			this.socket = new WebSocket(this.url);
		} else {
			// Node.js environment
			const WebSocket = require('ws');
			this.socket = new WebSocket(this.url);
		}

		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onclose = this.onClose.bind(this);
		this.socket.onerror = this.onError.bind(this);
	}

	close(): void {
		this.closedOnPurpose = true;
		this.socket.close();
		if (this.connectedResolve) {
			this.connectedResolve();
			this.connectedResolve = undefined;
		}
		this.connected = undefined;
	}

	send(data: string | ArrayBuffer): void {
		if (this.socket && this.socket.readyState === (WebSocket as any).OPEN) {
			this.socket.send(data);
		} else {
			console.error('WebSocket is not open. Unable to send message.');
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
		if (this.connectedResolve) {
			this.connectedResolve();
			this.connectedResolve = undefined;
		}
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
