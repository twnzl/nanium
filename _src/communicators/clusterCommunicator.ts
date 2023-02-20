import { NaniumCommunicator } from '../interfaces/communicator';
import * as cluster from 'cluster';
import { Nanium } from '../core';
import { ExecutionContext } from '../interfaces/executionContext';

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
			process.on('message', (msg: Message) => {
				Nanium.logger.info('worker ', cluster.worker?.id, ': receive message ', msg.type);
				if (msg.type === 'event_emit') {
					const eventMessage = msg as Message<EmitEventMessage>;
					Nanium.emit(eventMessage.data.event, eventMessage.data.eventName, eventMessage.data.context, false);
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
}

class Message<T = any> {
	constructor(
		public type: MessageType,
		public data: T,
		public from?: number
	) {
	}
}

type MessageType = 'event_emit';

class EmitEventMessage {
	event: any;
	eventName: string;
	context?: ExecutionContext;
}
