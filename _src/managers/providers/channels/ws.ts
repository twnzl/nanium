import { ChannelConfig } from '../../../interfaces/channelConfig';
import { Channel } from '../../../interfaces/channel';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { WebSocketServer } from 'ws';

export interface NaniumWebsocketChannelConfig extends ChannelConfig {
	/**
	 * if not set, NaniumWebsocketChannel will create one
	 */
	server?: WebSocketServer;

	/**
	 * if no server is set, this port will be used for opening a web socket connection
	 */
	port?: number;
}

export class NaniumWebsocketChannel implements Channel {
	private serviceRepository: NaniumRepository;
	private readonly config: NaniumWebsocketChannelConfig;

	public eventSubscriptions: { [eventName: string]: EventSubscription[] } = {};

	constructor(config: NaniumWebsocketChannelConfig) {
		this.config = {
			...{
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
			},
			...(config || {})
		};
	}

	async init(serviceRepository: NaniumRepository): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.eventSubscriptions = {};
		this.config.server = this.config.server ?? new WebSocketServer({
			port: this.config.port ?? 80,
			perMessageDeflate: {
				zlibDeflateOptions: {
					// See zlib defaults.
					chunkSize: 1024,
					memLevel: 7,
					level: 3
				},
				zlibInflateOptions: {
					chunkSize: 10 * 1024
				},
				// Other options settable:
				clientNoContextTakeover: true, // Defaults to negotiated value.
				serverNoContextTakeover: true, // Defaults to negotiated value.
				serverMaxWindowBits: 10, // Defaults to negotiated value.
				// Below options specified as default values.
				concurrencyLimit: 10, // Limits zlib concurrency for perf.
				threshold: 1024 // Size (in bytes) below which messages
				// should not be compressed if context takeover is disabled.
			}
		});

		this.config.server.on('connection', function connection(ws) {
			ws.on('message', function message(data) {
				console.log('received: %s', data);
			});

			ws.send('something');
		});

	}


	//#region service request handling
	//#endregion service request handling

	//#region event handling
	emitEvent(event: any, subscription: EventSubscription): Promise<void> {
		throw new Error('NotYetImplemented');
	}

	//#endregion event handling
}
