import { ServiceManager } from '../../interfaces/serviceManager';
import { NaniumJsonSerializer } from '../../serializers/json';
import { ServiceConsumerConfig } from '../../interfaces/serviceConsumerConfig';
import { ExecutionContext } from '../../interfaces/executionContext';
import { EventHandler } from '../../interfaces/eventHandler';
import { EventSubscription } from '../../interfaces/eventSubscription';

export interface NaniumConsumerBrowserWebsocketConfig extends ServiceConsumerConfig {
	url: string;
	//onServerConnectionRestored?: () => void;
}

export class NaniumConsumerBrowserWebsocket implements ServiceManager {
	config: NaniumConsumerBrowserWebsocketConfig;
	private activeRequests: { abort: Function }[] = [];
	private socket: WebSocket;

	constructor(config?: NaniumConsumerBrowserWebsocketConfig) {
		this.config = {
			...{
				url: 'http://localhost:3000',
				onServerConnectionRestored: () => {
				},
				requestInterceptors: [],
				serializer: new NaniumJsonSerializer(),
				handleError: (response) => {
					alert(response);
					return Promise.resolve();
				},
				isResponsible: async (): Promise<number> => Promise.resolve(1),
				isResponsibleForEvent: async (): Promise<number> => Promise.resolve(1),
			},
			...(config || {})
		};
	}

	async init(): Promise<void> {
		// Create WebSocket connection.
		this.socket = new WebSocket(this.config.url);

		// Connection opened
		this.socket.addEventListener('open', (_event) => {
			this.socket.send('Hello Server!');
		});

		// Listen for messages
		this.socket.addEventListener('message', (event) => {
			console.log('Message from server ', event.data);
		});
	}

	async terminate(): Promise<void> {
		for (const ar of this.activeRequests) {
			ar.abort();
		}
		this.activeRequests = [];
		this.socket.close();
	}

	async isResponsible(request: any, serviceName: string): Promise<number> {
		return await this.config.isResponsible(request, serviceName);
	}

	async execute<T>(serviceName: string, request: any): Promise<any> {

		// execute request interceptors
		if (this.config.requestInterceptors?.length) {
			for (const interceptor of this.config.requestInterceptors) {
				await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, {});
			}
		}

		// execute the request
		return await this.sendRequest(serviceName, request);
	}

	public async sendRequest(serviceName: string, request: any): Promise<any> {
		const body: string | ArrayBuffer = this.config.serializer.serialize({ serviceName, request });
		try {
			
		} catch (e) {
			let error: any;
			if (e instanceof ArrayBuffer) {
				error = new TextDecoder().decode(e);
			} else {
				error = e;
			}
			if (typeof error === 'string') {
				const deserialized: any = this.config.serializer.deserialize(e);
				// todo: make an Error class configurable so that NaniumObject.create can also be used for Error Objects.
				if (this.config.handleError) {
					await this.config.handleError(deserialized);
				} else {
					throw deserialized;
				}
			} else {
				throw e;
			}
		}
	}


	async subscribe(eventConstructor: new () => any, handler: EventHandler): Promise<EventSubscription> {
		throw new Error('NotYetImplemented');
	}

	async unsubscribe(subscription?: EventSubscription): Promise<void> {
		throw new Error('NotYetImplemented');
	}

	emit(eventName: string, event: any, context: ExecutionContext): any {
		throw new Error('NotYetImplemented');
	}

	async isResponsibleForEvent(eventName: string, context?: any): Promise<number> {
		return await this.config.isResponsibleForEvent(eventName, context);
	}

	receiveSubscription(subscriptionData: EventSubscription): Promise<void> {
		throw new Error('not implemented');
	}
}
