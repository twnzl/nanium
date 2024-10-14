import { EmitEventMessage, Message, NaniumCommunicator } from '../interfaces/communicator';
import * as cluster from 'cluster';
import { Nanium } from '../core';
import { ExecutionContext } from '../interfaces/executionContext';
import { EventSubscription } from '../interfaces/eventSubscription';
import { ServiceProviderManager } from '../interfaces/serviceProviderManager';

export class ClusterCommunicator<TExecutionContext extends ExecutionContext> implements NaniumCommunicator {
	private primaryMessageListenerInstalled: { [key: string]: boolean } = {};

	constructor(
		private toTransferableContext: (context: TExecutionContext) => any,
		private fromTransferableContext: (data: any) => TExecutionContext
	) {
		if (cluster.isMaster) {
			cluster.on('exit', (worker, code, signal) => {
				Nanium.logger.info(`worker ${worker.id} died (${signal || code}).`);
				delete this.primaryMessageListenerInstalled[worker.id];
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
				if (msg.data?.context) {
					msg.data.context = this.fromTransferableContext(msg.data.context);
				}
				if (msg.type === 'event_emit') {
					const eventMessage = msg as Message<EmitEventMessage>;
					Nanium.emit(eventMessage.data.event, eventMessage.data.eventName, msg.data.context, false);
				}
				// events must always be emitted in all processes.
				// For all other messages the managers and channels have to decide what to do,
				// because action depends on the special implementations and used technologies
				Nanium.managers?.forEach(m => {
					if ((m as ServiceProviderManager).receiveCommunicatorMessage) {
						(m as ServiceProviderManager).receiveCommunicatorMessage(msg);
					}
				});
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
					new Message<EmitEventMessage>('event_emit', {
						event,
						eventName,
						context: this.toTransferableContext(context as TExecutionContext)
					}, cluster.worker.id),
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
					new Message<Partial<EventSubscription>>('event_subscribe', subscription, cluster.worker.id),
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
					new Message<Partial<EventSubscription>>('event_unsubscribe', subscription, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}

	async broadcastRemoveClient(clientId: string): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			if (cluster.worker) {
				Nanium.logger.info('worker ', cluster.worker?.id, ': send remove_client message to primary ');
				process.send(
					new Message<Partial<string>>('remove_client', clientId, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}

	async broadcast(message: any): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			if (cluster.worker) {
				Nanium.logger.info('worker ', cluster.worker?.id, ': send event_unsubscribe message to primary ');
				process.send(
					new Message('generic', message, cluster.worker.id),
					undefined, undefined,
					e => (e ? reject(e) : resolve())
				);
			}
		});
	}
}
