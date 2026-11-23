import * as path from 'path';
import { pathToFileURL } from 'url';
import findFiles from 'recursive-readdir';
import { EventSubscription } from '../../interfaces/eventSubscription.js';
import { NaniumLogger } from '../../interfaces/logger.js';
import { NaniumObject, genericTypesSymbol } from '../../objects.js';
export class NaniumNodejsProviderConfig {
    constructor() {
        /**
         * root path where nanium should search for service executor implementations
         * if not given - no automatic registration of the services is done,
         * but it can be done manually by using ServiceProviderManager.addService().
         * This may be useful for unit tests to register MockImplementations for some services
         */
        this.servicePath = 'services';
        /**
         * array of channels for incoming requests
         * !do not change this collection after the manager has been initialized (that means after calling Nanium.addManager())!
         */
        this.channels = [];
    }
}
export class NaniumProviderNodejs {
    constructor(config) {
        this.eventSubscriptions = {};
        this.config = {
            servicePath: 'services',
            requestInterceptors: [],
            isResponsible: async () => Promise.resolve(1),
            isResponsibleForEvent: async () => Promise.resolve(1),
            handleError: async (err) => {
                throw err;
            }
        };
        this.config = {
            ...this.config,
            ...config
        };
        this.repository = {};
    }
    addService(requestClass, executorClass) {
        this.repository[requestClass.serviceName] = {
            Executor: executorClass,
            Request: requestClass
        };
    }
    addChannel(channel) {
        channel.init(this.repository, this).then();
        channel.onClientRemoved.push(clientId => this.removeClient(clientId));
        this.config.channels = this.config.channels ?? [];
        this.config.channels.push(channel);
    }
    getRequestClass(serviceName) {
        return this.repository[serviceName]?.Request;
    }
    async init() {
        // init repository
        if (this.config.servicePath) {
            let files;
            try {
                files = await findFiles(path.resolve(this.config.servicePath), [(f, stats) => !stats.isDirectory() && !f.endsWith('.contract.js')]);
            }
            catch (e) {
                NaniumLogger.error(e);
                throw new Error('nanium: service path does not exist. Please specify an absolute path (or relative to the working directory) to the property "servicePath" when initializing NaniumProviderNodejs');
            }
            for (const file of files) {
                try {
                    const request = NaniumProviderNodejs.findClassWithServiceNameProperty(await import(pathToFileURL(path.resolve(file)).href));
                    if (!request) {
                        NaniumLogger.warn('invalid contract file (no request class found): ' + file);
                        continue;
                    }
                    const executor = NaniumProviderNodejs.findClassWithServiceNameProperty(await import(pathToFileURL(path.resolve(file.replace(/\.contract\.js$/, '.executor.js'))).href));
                    this.addService(request, executor);
                    NaniumLogger.info('service ready: ' + executor.serviceName);
                }
                catch (e) {
                    NaniumLogger.error(e);
                    throw e;
                }
            }
        }
        // init channels over which requests can come from public scope
        if (this.config.channels && this.config.channels.length) {
            for (const channel of this.config.channels) {
                await channel.init(this.repository, this);
                channel.onClientRemoved.push(clientId => this.removeClient(clientId));
            }
        }
    }
    async terminate() {
        for (const channel of this.config.channels ?? []) {
            if (typeof channel.terminate === 'function') {
                await channel.terminate();
            }
        }
    }
    static findClassWithServiceNameProperty(module) {
        for (const requestModuleKey in module) {
            if ('serviceName' in module[requestModuleKey]) {
                return module[requestModuleKey];
            }
        }
    }
    async isResponsible(request, serviceName) {
        return await this.config.isResponsible(request, serviceName);
    }
    async execute(serviceName, request, context) {
        context = context || {};
        let realRequest;
        try {
            // validation
            if (this.repository === undefined) {
                return await this.config.handleError(new Error('nanium server is not initialized'), serviceName, request, context);
            }
            if (!Object.prototype.hasOwnProperty.call(this.repository, serviceName)) {
                return await this.config.handleError(new Error('unknown service ' + serviceName), serviceName, request, context);
            }
            const requestConstructor = this.repository[serviceName].Request;
            if (context?.scope === 'public') { // private is the default, all adaptors have to set the scope explicitly
                if (!requestConstructor.scope || requestConstructor.scope !== 'public') {
                    return await this.config.handleError(new Error('unauthorized'), serviceName, request, context);
                }
            }
            // if the request comes from a communication channel it is normally a deserialized object,
            // but we need real object that is constructed via the request constructor
            if (request.constructor !== requestConstructor) {
                realRequest = NaniumObject.create(request, requestConstructor, requestConstructor[genericTypesSymbol]);
            }
            else {
                realRequest = request;
            }
            // execution
            if (context?.scope === 'public') {
                await this.executeRequestInterceptors(realRequest, context, this.repository[serviceName].Request);
            }
            const executor = new this.repository[serviceName].Executor();
            return await executor.execute(realRequest, context);
        }
        catch (e) {
            return await this.config.handleError(e, serviceName, request, context);
        }
    }
    /**
     * execute request interceptors
     */
    async executeRequestInterceptors(request, context, requestType) {
        if (!this.config.requestInterceptors?.length) {
            return;
        }
        for (const interceptor of this.config.requestInterceptors) {
            const name = interceptor.execute ? interceptor.constructor.name : interceptor.name;
            if (requestType.skipInterceptors === true ||
                (Array.isArray(requestType.skipInterceptors) && requestType.skipInterceptors.includes(name)) ||
                (context?.scope && (requestType.skipInterceptors ?? {})[context.scope] === true) ||
                (context?.scope && (Array.isArray(requestType.skipInterceptors ?? {})[context.scope]) && requestType.skipInterceptors[context.scope].includes(name))) {
                continue;
            }
            await (typeof interceptor === 'function' ? new interceptor() : interceptor).execute(request, context);
        }
    }
    async emit(eventName, event, executionContext) {
        let emissionOk;
        const interceptors = this.config.eventEmissionSendInterceptors?.map((instanceOrClass) => typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass) ?? [];
        for (const subscription of this.eventSubscriptions[eventName] ?? []) { // subscriptions
            emissionOk = true;
            for (const interceptor of interceptors) { // interceptors
                emissionOk = await interceptor.execute(event, executionContext, subscription);
                if (!emissionOk) {
                    break;
                }
            }
            if (emissionOk) {
                if (subscription.handler) { // subscription on server internally
                    subscription.handler(event);
                }
                else { // subscription of remote client - send through channel
                    this.config.channels.find(c => c.id === subscription.channelId)
                        ?.emitEvent(event, subscription).then();
                }
            }
        }
    }
    async isResponsibleForEvent(eventName, context) {
        return await this.config.isResponsibleForEvent(eventName, context);
    }
    async subscribe(eventConstructor, handler, context) {
        const eventName = typeof eventConstructor === 'string' ? eventConstructor : eventConstructor.eventName;
        const subscription = new EventSubscription('', eventName, handler);
        subscription.context = context;
        this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName] ?? [];
        this.eventSubscriptions[eventName].push(subscription);
        return subscription;
    }
    async unsubscribe(subscription, eventName) {
        eventName = subscription?.eventName ?? eventName;
        try {
            if (this.config.eventSubscriptionReceiveInterceptors?.length) {
                let interceptor;
                for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
                    interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
                    await interceptor.execute(subscription);
                }
            }
        }
        catch (e) {
            await this.config.handleError(e, undefined, undefined);
        }
        if (subscription) {
            if (eventName in this.eventSubscriptions) {
                this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName]
                    .filter(s => s.id !== subscription.id);
                if (!this.eventSubscriptions[eventName].length) {
                    delete this.eventSubscriptions[eventName];
                }
            }
        }
        else {
            delete this.eventSubscriptions[eventName];
        }
    }
    async receiveSubscription(subscription) {
        try {
            if (this.config.eventSubscriptionReceiveInterceptors?.length) {
                let interceptor;
                for (const instanceOrClass of this.config.eventSubscriptionReceiveInterceptors) {
                    interceptor = typeof instanceOrClass === 'function' ? new instanceOrClass() : instanceOrClass;
                    await interceptor.execute(subscription);
                }
            }
            this.eventSubscriptions[subscription.eventName] = this.eventSubscriptions[subscription.eventName] ?? [];
            this.eventSubscriptions[subscription.eventName].push(subscription);
        }
        catch (e) {
            await this.config.handleError(e, undefined, undefined);
        }
    }
    receiveCommunicatorMessage(msg) {
        this.config.channels.forEach(c => {
            if (c.receiveCommunicatorMessage) {
                c.receiveCommunicatorMessage(msg);
            }
        });
    }
    async removeClient(clientId) {
        for (const eventName of Object.keys(this.eventSubscriptions)) {
            this.eventSubscriptions[eventName] = this.eventSubscriptions[eventName]
                .filter(s => s.clientId !== clientId);
        }
    }
}
//# sourceMappingURL=nodejs.js.map