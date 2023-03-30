import { EventBase } from '../eventBase';
import { EventType } from '../../../objects';

@EventType({
	scope: 'public'
})
export class Stuff2Event extends EventBase<Stuff2Event> {
	static eventName: string = 'NaniumTest:test/stuff2';
}
