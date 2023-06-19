import { NaniumCommunicator } from '../interfaces/communicator';
import * as cluster from 'cluster';
import { Nanium } from '../core';
import { ExecutionContext } from '../interfaces/executionContext';
import { EventSubscription } from '../interfaces/eventSubscription';

export class ClusterCommunicator implements NaniumCommunicator {
	private primaryMessageListenerInstalled: { [key: string]: boolean } = {};

	constructor() {
		if (cluster.isMaster) {
			cluster.on('exit', (worker, code, signal) => {
				Nanium.logger.info(`worker ${worker.id} died (${signal || code}).`);
				this.primaryMessageListenerInstalled[worker.id] = false;
			});
			cluster.on('fork', (worker) => {
				if (!this.primaryMessageListenerInstalled[worker.id]) {
					Nanium.logger.info('primary: install message handler for new worker', worker.id);
					worker.on('message', (msg: Message) => {
						this.primaryMessageListener(worker.id.toString(), msg);
					});
					this.primaryMessageListenerInstalled[worker.id] = true;
				}
			});
			for (const id in cluster.workers) {
				if (!this.primaryMessageListenerInstalled[id]) {
					Nanium.logger.info('primary: install message handler for worker ', id);
					cluster.workers[id].on('message', (msg: Message) => {
						this.primaryMessageListener(id, msg);
					});
					this.primaryMessageListenerInstalled[id] = true;
				}
			}
		} else if (cluster.isWorker) {
			process.on('message', async (msg: Message) => {
				Nanium.logger.info('worker ', cluster.worker?.id, ': receive message ', msg.type);
				if (msg.type === 'event_emit') {
					const eventMessage = msg as Message<EmitEventMessage>;
					Nanium.emit(eventMessage.data.event, eventMessage.data.eventName, eventMessage.data.context, false);
				} else if (msg.type === 'event_subscribe') {
					const eventMessage = msg as Message<EventSubscription>;
					await Nanium.receiveSubscription(eventMessage.data, false);
				} else if (msg.type === 'event_unsubscribe') {
					const eventMessage = msg as Message<EventSubscription>;
					await Nanium.unsubscribe(eventMessage.data, undefined, false);
				}
			});
		}
	}

	private primaryMessageListener(workerId: string, msg: Message<any>) {
		for (const worker of Object.values(cluster.workers)) {
			if (worker.id.toString() === workerId) {
				continue;
			}
			Nanium.logger.info('primary: send message ', msg.type, ' to worker ', worker.id);
			worker.send(msg, undefined, e => {
				if (e) {
					Nanium.logger.error(e);
				}
			});
		}
	}

	async broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			if (cluster.worker) {
				Nanium.logger.info('worker ', cluster.worker?.id, ': send event_emit message to primary ');
				process.send(
					new Message<EmitEventMessage>('event_emit', { event, eventName, context }, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}

	async broadcastSubscription(subscription: EventSubscription): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			if (cluster.worker) {
				Nanium.logger.info('worker ', cluster.worker?.id, ': send event_subscribe message to primary ');
				process.send(
					new Message<EventSubscription>('event_subscribe', subscription, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}

	async broadcastUnsubscription(subscription: EventSubscription): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			if (cluster.worker) {
				Nanium.logger.info('worker ', cluster.worker?.id, ': send event_unsubscribe message to primary ');
				process.send(
					new Message<EventSubscription>('event_unsubscribe', subscription, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}
}

class Message<T = any> {
	constructor(
		public type: MessageType,
		public data: T,
		public from?: number
	) {
	}
}

type MessageType = 'event_emit' | 'event_subscribe' | 'event_unsubscribe';

class EmitEventMessage {
	event: any;
	eventName: string;
	context?: ExecutionContext;
}
