import { EventBase } from '../eventBase';

// todo: events: Decorator EventType + plainToClass Deserialization on both sides of the API
// @EventType({
// 	genericTypes: ServiceResponseBase,
// 	skipInterceptors: [TestServerRequestInterceptor],
// 	scope: 'public'
// })
export class StuffCreatedEvent extends EventBase {
	static eventName: string = 'NaniumTest:test/stuffAdded';

	constructor(
		public aNumber: number,
		public aString: string,
		public aDate: Date
	) {
		super();
	}
}
