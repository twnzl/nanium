import { AsyncHelper, ExtendedPromise } from '../../helper.js';

export interface WebSocketType {
	readonly readyState: number;
	readonly bufferedAmount: number;
	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onclose: ((event: CloseEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
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
			if (this.socket.readyState === (WebSocket as any).OPEN) {
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
