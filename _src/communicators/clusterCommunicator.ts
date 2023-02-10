import { NaniumCommunicator } from '../interfaces/communicator';
import * as cluster from 'cluster';
import { Nanium } from '../core';
import { ExecutionContext } from '../interfaces/executionContext';

export class ClusterCommunicator implements NaniumCommunicator {

	constructor() {
		if (cluster.isMaster) {
			for (const id in cluster.workers) {
				cluster.workers[id].on('message', (msg: Message) => {
					for (const worker of Object.values(cluster.workers)) {
						if (worker.id.toString() === id) {
							continue;
						}
						worker.send(msg, undefined, e => {
							if (e) {
								Nanium.logger.error(e);
							}
						});
					}
				});
			}
		} else if (cluster.isWorker) {
			process.on('message', (msg: Message) => {
				if (msg.type === 'event_emit') {
					const eventMessage = msg as Message<EmitEventMessage>;
					Nanium.emit(eventMessage.data.event, eventMessage.data.eventName, eventMessage.data.context, false);
				}
			});
		}
	}

	async broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void> {
		await new Promise<void>((resolve: Function, reject: Function) => {
			process.send(
				new Message<EmitEventMessage>('event_emit', { event, eventName, context }, cluster.worker.id),
				undefined, undefined,
				e => (e ? reject(e) : resolve())
			);
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
