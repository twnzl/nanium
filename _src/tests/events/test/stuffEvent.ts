import { EventBase } from '../eventBase';
import { EventType, Type } from '../../../objects';

@EventType({
	scope: 'public'
})
export class StuffEvent extends EventBase<StuffEvent> {
	static eventName: string = 'NaniumTest:test/stuff';

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
