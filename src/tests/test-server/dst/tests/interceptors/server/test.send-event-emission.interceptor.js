export class TestEventEmissionSendInterceptor {
    async execute(event, context, subscription) {
        // this ensures, that generally all events are only sent to clients of the same tenant
        return Promise.resolve(context.tenant === subscription.context.tenant);
    }
}
//# sourceMappingURL=test.send-event-emission.interceptor.js.map