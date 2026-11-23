import { EventBase } from '../eventBase.js';
import { EventType } from '../../../objects.js';

@EventType({
	scope: 'public'
})
export class Stuff2Event extends EventBase<Stuff2Event> {
	static eventName: string = 'NaniumTest:test/stuff2';
}
