import { Nanium } from '../../../core';
import { ChannelConfig } from '../../../interfaces/channelConfig';
import { Channel } from '../../../interfaces/channel';
import { NaniumRepository } from '../../../interfaces/serviceRepository';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { EventSubscription } from '../../../interfaces/eventSubscription';
import { ServiceProviderManager } from '../../../interfaces/serviceProviderManager';
import * as WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { WsMessage } from './ws.types';

const clientIdSymbol: symbol = Symbol.for('__client_id__');

export interface NaniumWebsocketChannelConfig extends ChannelConfig {
	// apiPath?: string;
	server: HttpServer | HttpsServer | { use: Function };
	eventPath?: string;
}

export class NaniumWebsocketChannel implements Channel {
	manager: ServiceProviderManager;
	onClientRemoved: ((clientId: string) => void)[] = [];

	private readonly config: NaniumWebsocketChannelConfig;
	private wss: WebSocket.Server;
	private clientSubscriptionInfo: Map<string, ClientSubscriptionInfo> = new Map(); // first client ID

	constructor(config: NaniumWebsocketChannelConfig) {
		this.config = {
			...{
				server: undefined,
				eventPath: config.eventPath?.toLowerCase() ?? '',
				serializer: new NaniumJsonSerializer(),
				executionContextConstructor: Object,
				longPollingRequestTimeoutInSeconds: 30
			},
			...(config || {})
		};
	}

	async init(_serviceRepository: NaniumRepository, _manager: ServiceProviderManager): Promise<void> {
		this.wss = new WebSocket.Server({ server: this.config.server });
		this.wss.on('connection', (ws: WebSocket) => {
			// Handle messages from the client
			ws.on('message', (rawMessage: ArrayBuffer | string) => {
				this.handleIncomingMessage(rawMessage, ws);
			});

			// Handle client disconnection
			ws.on('close', () => {
				// remove subscriptions of this socket
				this.removeClient(ws[clientIdSymbol]);
			});

			// Handle errors
			ws.on('error', (error: Error) => {
				throw error;
			});
		});
	}

	async terminate(): Promise<void> {
		const perClient = this.clientSubscriptionInfo.values();
		for (const clientSubscription of perClient) {
			clientSubscription.websocket.terminate();
		}
		this.clientSubscriptionInfo = new Map();
	};

	removeClient?(clientId: string) {
		if (clientId) {
			this.clientSubscriptionInfo.delete(clientId);
			for (const handler of this.onClientRemoved) {
				handler(clientId);
			}
		}
	}

	private async handleIncomingMessage(rawMessage: ArrayBuffer | string, ws: WebSocket): Promise<void> {
		const message: WsMessage = this.config.serializer.deserialize(rawMessage);
		switch (message.type) {
			case 'subscribe_event':
				return this.handleIncomingEventSubscription(message, ws);
			case 'unsubscribe_event':
				return this.handleIncomingEventUnsubscription(message);
		}
	}

	//#region service request handling
	async process(): Promise<any> {
		throw new Error('NotYetImplemented');
	}

	//#endregion service request handling

	//#region event handling
	private async handleIncomingEventSubscription(message: WsMessage<EventSubscription>, ws: WebSocket): Promise<void> {
		Nanium.logger.info('channel ws: incoming event subscription: ', message.content.eventName);
		// ask the manager to execute interceptors and to decide if the subscription is accepted or not
		try {
			const subscription: EventSubscription = message.content;
			subscription.channel = this;
			await Nanium.receiveSubscription(subscription);
			ws[clientIdSymbol] ??= message.content.clientId;
			if (!this.clientSubscriptionInfo.has(subscription.clientId)) {
				this.clientSubscriptionInfo.set(subscription.clientId, new ClientSubscriptionInfo(ws));
			}
			const subscriptionsOfClient = this.clientSubscriptionInfo.get(subscription.clientId);
			if (subscriptionsOfClient.eventNames.has(subscription.eventName)) {
				Nanium.logger.info(`duplicat event subscription: eventName=${subscription.eventName}, clientId = ${subscription.clientId}`);
			} else {
				subscriptionsOfClient.eventNames.add(subscription.eventName);
			}
		} catch (e) {
			Nanium.logger.error(e);
			// todo: should the client be informed about the error ?
			throw e;
		}
	}

	private async handleIncomingEventUnsubscription(message: WsMessage<EventSubscription>): Promise<void> {
		Nanium.logger.info('channel ws: incoming event unsubscription: ', message.content.eventName);
		try {
			//todo: create real instances of EventSubscription and additionalData  e.g:
			// const subscriptionData: EventSubscription = NaniumObject.create(
			// 	this.config.serializer.deserialize(Buffer.concat(data).toString()),
			// 	EventSubscription,
			// 	{'TData': this.config.subscriptionDataConstructor}
			// );

			// remove subscription
			const clientSubscription = this.clientSubscriptionInfo.get(message.content.clientId);
			if (clientSubscription) {
				clientSubscription.eventNames.delete(message.content.eventName);
				// close websocket if no other subscriptions exist.
				if (!clientSubscription.eventNames?.size) {
					clientSubscription.websocket?.close();
					this.clientSubscriptionInfo.delete(message.content.clientId);
				}
			}
			// unsubscribe core
			await Nanium.unsubscribe(message.content);
		} catch (e) {
			Nanium.logger.error(e);
			// todo: should the client be informed about the error ?
			throw e;
		}
	}

	async emitEvent(event: any, subscription?: EventSubscription): Promise<void> {
		const message: WsMessage = {
			type: 'emit_event',
			content: {
				eventName: event.constructor.eventName ?? subscription?.eventName,
				event
			}
		};
		let serialized: string | ArrayBuffer = this.config.serializer.serialize(message);
		// loop through subscriptions and send event message
		this.clientSubscriptionInfo.forEach((clientSubscription) => {
			try {
				if (clientSubscription.eventNames?.has(message.content.eventName)) {
					clientSubscription.websocket?.send(serialized);
				}
			} catch (e) {
				Nanium.logger.error('websocket channel: emitEvent: ', e.message, e.stack);
			}
		});
	}

	//#endregion event handling
}

class ClientSubscriptionInfo {
	eventNames: Set<string> = new Set<string>();

	constructor(public websocket: WebSocket) {
	}
}
