import { EventBase } from '../eventBase';
import { EventType, Type } from '../../../serializers/core';

// todo: events: Decorator EventType + plainToClass Deserialization
@EventType({
	scope: 'public'
})
export class StuffCreatedEvent extends EventBase {
	static eventName: string = 'NaniumTest:test/stuffAdded';

	@Type(Number) public aNumber: number;
	@Type(String) public aString: string;
	@Type(Date) public aDate: Date;

	constructor(
		aNumber: number,
		aString: string,
		aDate: Date,
	) {
		super();
		this.aString = aString;
		this.aNumber = aNumber;
		this.aDate = aDate;
	}
}
