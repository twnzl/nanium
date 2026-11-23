// todo: Automatically removing of unnecessary code (Minimizing/TreeShaking) will not work for nanium as a commonJs module
import { DateHelper } from './helper.js';
import { NaniumLogger } from './interfaces/logger.js';
import { genericTypesSymbol, NaniumObject } from './objects.js';
export const managerSymbol = Symbol.for('__nanium__manager__');
export class CNanium {
    constructor() {
        this.managers = [];
        this.queues = [];
        // Supports functions to communicate with other processes or threads of the same server instance or even other hosted
        // server instances of the same nanium scope.
        // for example this is used to spread information about emitted events
        this.communicators = [];
        //#endregion queue
    }
    get isShutDownInitiated() {
        return this._isShutDownInitiated;
    }
    async addManager(manager) {
        this.managers.push(manager);
        await manager.init();
    }
    async removeManager(manager) {
        this.managers = this.managers.filter(m => m !== manager);
        await manager.terminate();
    }
    async addQueue(queue) {
        this.queues.push(queue);
        await queue.init();
        await this.startQueue(queue);
    }
    async removeQueue(fn) {
        const queues = this.queues.filter(fn);
        await Promise.all(queues.map(queue => {
            return queue.stop();
        }));
        this.queues = this.queues.filter((q) => !fn(q));
    }
    async execute(request, serviceName, context) {
        serviceName = serviceName || request.constructor.serviceName;
        const manager = await this.getResponsibleManager(request, serviceName);
        if (!manager) {
            throw new Error('no responsible manager for Service "' + serviceName + '" found');
        }
        const result = await manager.execute(serviceName, request, context);
        return result;
    }
    async enqueue(entry, executionContext) {
        const queue = await this.getResponsibleQueue(entry, executionContext);
        if (!queue) {
            throw new Error('nanium: no queue has been initialized');
        }
        delete entry.response;
        delete entry.id;
        entry.state = 'ready';
        const result = await queue.enqueue(entry, executionContext);
        this.executeTimeControlled(result, queue);
        return result;
    }
    emit(event, eventName, context, broadcast = true) {
        eventName = eventName ?? event.constructor.eventName;
        this.managers.forEach((manager) => manager.emit(eventName, event, context));
        if (broadcast) {
            for (const communicator of this.communicators) {
                communicator.broadcastEvent(event, eventName, context).then();
            }
        }
    }
    async subscribe(eventNameOrConstructor, handler, context, manager) {
        const eventName = typeof eventNameOrConstructor === 'string' ? eventNameOrConstructor : eventNameOrConstructor.eventName;
        if (!manager) {
            manager = await this.getResponsibleManagerForEvent(eventName, context);
        }
        if (!manager) {
            throw new Error('no responsible manager for event "' + eventName + '" found');
        }
        const subscription = await manager.subscribe(eventNameOrConstructor, handler, context);
        subscription[managerSymbol] = manager;
        return subscription;
    }
    async unsubscribe(subscriptionOrManager, eventName, broadcast = true) {
        let subscription;
        let manager;
        if (subscriptionOrManager) {
            if ('eventName' in subscriptionOrManager) {
                subscription = subscriptionOrManager;
            }
            else {
                manager = subscriptionOrManager;
            }
        }
        eventName = eventName ?? subscription?.eventName;
        manager ??= subscription ? subscription[managerSymbol] : undefined;
        if (manager) {
            await manager.unsubscribe(subscription, eventName);
        }
        else {
            for (const manager of this.managers) {
                await manager.unsubscribe(subscription, eventName);
            }
        }
        if (broadcast) {
            this.communicators.forEach(c => c.broadcastUnsubscription(subscription));
        }
    }
    async removeClient(clientId, broadcast = true) {
        for (const manager of this.managers) {
            await manager.removeClient(clientId);
        }
        if (broadcast) {
            this.communicators.forEach(c => c.broadcastRemoveClient(clientId));
        }
    }
    async receiveSubscription(subscription, broadcast = true) {
        const responsibleManager = await this.getResponsibleManagerForEvent(subscription.eventName, subscription);
        await responsibleManager?.receiveSubscription(subscription);
        if (broadcast) {
            this.communicators.forEach(c => c.broadcastSubscription(subscription));
        }
    }
    async getResponsibleManager(request, serviceName) {
        if (this.managers.length === 0) {
            throw new Error('nanium: no managers registered - call Nanium.addManager().');
        }
        const priorities = await Promise.all(this.managers.map((manager) => manager.isResponsible(request, serviceName)));
        const maxPriority = Math.max(...priorities);
        const idx = priorities.findIndex(p => p === maxPriority);
        if (idx >= 0 && priorities[idx] > 0) {
            return this.managers[idx];
        }
        return undefined;
    }
    async getResponsibleManagerForEvent(eventName, data, context) {
        if (this.managers.length === 0) {
            throw new Error('nanium: no managers registered - call Nanium.addManager().');
        }
        const priorities = await Promise.all(this.managers.map((manager) => manager.isResponsibleForEvent(eventName, data, context)));
        const maxPriority = Math.max(...priorities);
        const idx = priorities.findIndex(p => p === maxPriority);
        if (idx >= 0 && priorities[idx] > 0) {
            return this.managers[idx];
        }
        return undefined;
    }
    //#region queue
    async getResponsibleQueue(entry, executionContext) {
        const priorities = await Promise.all(this.queues.map((queue) => queue.isResponsible(entry, executionContext)));
        const maxPriority = Math.max(...priorities);
        const idx = priorities.findIndex(p => p === maxPriority);
        if (idx >= 0 && priorities[idx] > 0) {
            return this.queues[idx];
        }
        return undefined;
    }
    async onReadyQueueEntry(entry, requestQueue) {
        try {
            await this.executeTimeControlled(entry, requestQueue);
        }
        catch (e) {
            NaniumLogger.error(e.message, e.stack);
        }
    }
    // execute an request considering the settings of startDate, interval, etc.
    executeTimeControlled(entry, requestQueue) {
        if (!this.isShutDownInitiated && !requestQueue.isShutdownInitiated) {
            if (!entry.startDate || new Date(entry.startDate) < new Date()) {
                this.tryStart(entry, requestQueue).then();
            }
        }
    }
    async start(entry, requestQueue) {
        try {
            entry = await requestQueue.onBeforeStart(entry);
            // create request of real type
            const manager = await Nanium.getResponsibleManager(entry.request, entry.serviceName);
            const requestConstructor = manager.getRequestClass(entry.serviceName);
            let request;
            if (entry.request.constructor !== requestConstructor) {
                request = NaniumObject.create(entry.request, requestConstructor, requestConstructor[genericTypesSymbol]);
            }
            else {
                request = entry.request;
            }
            // update entry
            entry.startDate = entry.startDate || new Date();
            await requestQueue.updateEntry(entry);
            // execute
            entry.response = await this.execute(request, entry.serviceName, await requestQueue.getExecutionContext(entry, requestQueue));
            entry.state = 'done';
            entry.endDate = new Date();
            await requestQueue.updateEntry(entry);
        }
        catch (error) {
            try {
                entry.response = error.stack ? error.stack?.toString() : JSON.stringify(error, null, 2);
                entry.state = 'failed';
                entry.endDate = new Date();
                await requestQueue.updateEntry(entry);
            }
            catch (e) {
                await NaniumLogger.error(error);
                await NaniumLogger.error(e);
            }
        }
    }
    async tryStart(entry, requestQueue) {
        if (entry.endOfInterval && new Date() >= entry.endOfInterval) {
            entry.endDate = new Date();
            entry.state = 'canceled';
            await requestQueue.updateEntry(entry);
            return false;
        }
        entry = await requestQueue.tryTake(entry);
        if (!entry) {
            return false;
        }
        let lastRun;
        try {
            lastRun = new Date();
            await this.start(entry, requestQueue);
        }
        catch (e) {
            NaniumLogger.error(e);
        }
        finally {
            entry = await requestQueue.refreshEntry(entry);
            let nextRun = this.calculateNextRun(entry, lastRun);
            if (nextRun) {
                if (nextRun < new Date()) {
                    nextRun = new Date();
                }
                if (!entry.endOfInterval || nextRun < new Date(entry.endOfInterval)) {
                    const nextEntry = await requestQueue.copyEntry(entry);
                    delete nextEntry.response;
                    delete nextEntry.endDate;
                    delete nextEntry.id;
                    nextEntry.startDate = nextRun;
                    nextEntry.state = 'ready';
                    await requestQueue.enqueue(nextEntry); // every execution is a new entry, so you have state and result of each execution
                }
            }
        }
        return true;
    }
    calculateNextRun(entry, lastRun) {
        if (entry.interval !== undefined) {
            return DateHelper.addSeconds(entry.interval, lastRun);
        }
        else if (entry.recurring && Object.keys(entry.recurring).some(k => (entry.recurring[k] || '') != '')) {
            const now = new Date(Date.now());
            now.setMilliseconds(0);
            lastRun = new Date(lastRun);
            lastRun.setMilliseconds(0);
            if (now.getTime() === lastRun.getTime()) {
                now.setSeconds(now.getSeconds() + 1);
            }
            return this.calculateNextRunByCronConfig(entry.recurring, now);
        }
        return undefined;
    }
    calculateNextRunByCronConfig(config, now) {
        function parseField(field = '*', min, max) {
            if (field === '*') {
                return Array.from({ length: max - min + 1 }, (_, i) => i + min);
            }
            return field.split(',').flatMap(part => {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    return Array.from({ length: end - start + 1 }, (_, i) => i + start);
                }
                if (part.includes('/')) {
                    const [start, step] = part.split('/');
                    const startNum = start === '*' ? min : Number(start);
                    return Array.from({ length: Math.floor((max - startNum) / Number(step)) + 1 }, (_, i) => startNum + i * Number(step));
                }
                return [Number(part)];
            }).filter(num => num >= min && num <= max);
        }
        const currentYear = now.getFullYear();
        const seconds = parseField(config.second, 0, 59);
        const minutes = parseField(config.minute, 0, 59);
        const hours = parseField(config.hour, 0, 23);
        const daysOfMonth = parseField(config.dayOfMonth, 1, 31);
        const months = parseField(config.month, 1, 12);
        const daysOfWeek = parseField(config.dayOfWeek, 0, 6);
        const years = config.year === '*' ? [currentYear, currentYear + 1] : parseField(config.year, currentYear, currentYear + 100);
        for (const year of years) {
            for (const month of months) {
                const daysInMonth = new Date(year, month, 0).getDate();
                for (const day of daysOfMonth.filter(d => d <= daysInMonth)) {
                    const date = new Date(year, month - 1, day);
                    if (daysOfWeek.includes(date.getDay())) {
                        for (const hour of hours) {
                            for (const minute of minutes) {
                                for (const second of seconds) {
                                    const candidateDate = new Date(year, month - 1, day, hour, minute, second);
                                    if (candidateDate > now) {
                                        return candidateDate;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return undefined;
    }
    async shutdown() {
        if (this.queues?.length) {
            await Promise.all(this.queues.map((q) => {
                q.isShutdownInitiated = true;
                return q.stop();
            }));
            this.queues = [];
        }
        if (this.managers?.length) {
            await Promise.all(this.managers.map(m => m.terminate()));
            this.managers = [];
        }
    }
    async startQueue(requestQueue) {
        // load all current entries that have not been started so far and start them as configured
        const readyEntries = await requestQueue
            .getEntries({ states: ['ready'], startDateReached: true });
        for (const entry of readyEntries) {
            await this.executeTimeControlled(entry, requestQueue);
        }
    }
}
if (typeof global !== 'undefined') {
    if (!global['__nanium__']) {
        global['__nanium__'] = new CNanium();
    }
}
else if (typeof window !== 'undefined') {
    if (!window['__nanium__']) {
        window['__nanium__'] = new CNanium();
    }
}
else if (typeof globalThis !== 'undefined') {
    if (!globalThis['__nanium__']) {
        globalThis['__nanium__'] = new CNanium();
    }
}
export const Nanium = typeof global !== 'undefined' ? global['__nanium__'] : (typeof window !== 'undefined' ? window['__nanium__'] : globalThis['__nanium__']);
//# sourceMappingURL=core.js.map