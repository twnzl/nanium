import cluster from 'cluster';
import { Nanium } from '../core.js';
import { Message } from '../interfaces/communicator.js';
import { NaniumLogger } from '../interfaces/logger.js';
export class ClusterCommunicator {
    constructor(toTransferableContext, fromTransferableContext) {
        this.toTransferableContext = toTransferableContext;
        this.fromTransferableContext = fromTransferableContext;
        this.primaryMessageListenerInstalled = {};
        if (cluster.isMaster) {
            cluster.on('exit', (worker, code, signal) => {
                NaniumLogger.info(`worker ${worker.id} died (${signal || code}).`);
                delete this.primaryMessageListenerInstalled[worker.id];
            });
            cluster.on('fork', (worker) => {
                if (!this.primaryMessageListenerInstalled[worker.id]) {
                    NaniumLogger.info('primary: install message handler for new worker', worker.id);
                    worker.on('message', (msg) => {
                        this.primaryMessageListener(worker.id.toString(), msg);
                    });
                    this.primaryMessageListenerInstalled[worker.id] = true;
                }
            });
            for (const id in cluster.workers) {
                if (!this.primaryMessageListenerInstalled[id]) {
                    NaniumLogger.info('primary: install message handler for worker ', id);
                    cluster.workers[id].on('message', (msg) => {
                        this.primaryMessageListener(id, msg);
                    });
                    this.primaryMessageListenerInstalled[id] = true;
                }
            }
        }
        else if (cluster.isWorker) {
            process.on('message', async (msg) => {
                NaniumLogger.info('worker ', cluster.worker?.id, ': receive message ', msg.type);
                if (msg.data?.context) {
                    msg.data.context = this.fromTransferableContext(msg.data.context);
                }
                if (msg.type === 'event_emit') {
                    const eventMessage = msg;
                    Nanium.emit(eventMessage.data.event, eventMessage.data.eventName, msg.data.context, false);
                }
                // events must always be emitted in all processes.
                // For all other messages the managers and channels have to decide what to do,
                // because action depends on the special implementations and used technologies
                Nanium.managers?.forEach(m => {
                    if (m.receiveCommunicatorMessage) {
                        m.receiveCommunicatorMessage(msg);
                    }
                });
            });
        }
    }
    primaryMessageListener(workerId, msg) {
        for (const worker of Object.values(cluster.workers)) {
            if (worker.id.toString() === workerId) {
                continue;
            }
            NaniumLogger.info('primary: send message ', msg.type, ' to worker ', worker.id);
            worker.send(msg, undefined, e => {
                if (e) {
                    NaniumLogger.error(e);
                }
            });
        }
    }
    async broadcastEvent(event, eventName, context) {
        await new Promise((resolve, reject) => {
            if (cluster.worker) {
                NaniumLogger.info('worker ', cluster.worker?.id, ': send event_emit message to primary ');
                process.send(new Message('event_emit', {
                    event,
                    eventName,
                    context: this.toTransferableContext(context)
                }, cluster.worker.id), undefined, undefined, e => (e ? reject(e) : resolve()));
            }
            else {
                for (const id of Object.keys(cluster.workers)) {
                    cluster.workers[id].send(new Message('event_emit', {
                        event,
                        eventName,
                        context: this.toTransferableContext(context)
                    }), undefined, e => (e ? reject(e) : resolve()));
                }
            }
        });
    }
    async broadcastSubscription(subscription) {
        await new Promise((resolve, reject) => {
            if (cluster.worker) {
                NaniumLogger.info('worker ', cluster.worker?.id, ': send event_subscribe message to primary ');
                process.send(new Message('event_subscribe', subscription, cluster.worker.id), undefined, undefined, e => (e ? reject(e) : resolve()));
            }
        });
    }
    async broadcastUnsubscription(subscription) {
        await new Promise((resolve, reject) => {
            if (cluster.worker) {
                NaniumLogger.info('worker ', cluster.worker?.id, ': send event_unsubscribe message to primary ');
                process.send(new Message('event_unsubscribe', subscription, cluster.worker.id), undefined, undefined, e => (e ? reject(e) : resolve()));
            }
        });
    }
    async broadcastRemoveClient(clientId) {
        await new Promise((resolve, reject) => {
            if (cluster.worker) {
                NaniumLogger.info('worker ', cluster.worker?.id, ': send remove_client message to primary ');
                process.send(new Message('remove_client', clientId, cluster.worker.id), undefined, undefined, e => (e ? reject(e) : resolve()));
            }
        });
    }
    async broadcast(message) {
        await new Promise((resolve, reject) => {
            if (cluster.worker) {
                NaniumLogger.info('worker ', cluster.worker?.id, ': send event_unsubscribe message to primary ');
                process.send(new Message('generic', message, cluster.worker.id), undefined, undefined, e => (e ? reject(e) : resolve()));
            }
        });
    }
}
//# sourceMappingURL=clusterCommunicator.js.map