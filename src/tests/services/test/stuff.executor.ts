import { Stuff, StuffRequest } from './stuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { ServiceExecutionContext } from '../../../interfaces/serviceExecutionContext';

export class StuffExecutor implements ServiceExecutor<StuffRequest, Stuff<Date>[]> {
	static serviceName: string = 'NocatSelf.Stuff';

	async execute(request: StuffRequest, context?: ServiceExecutionContext): Promise<Stuff<Date>[]> {
		if (!(request instanceof StuffRequest)) {
			throw new Error('request ist not an instance of StuffRequest');
		}
		return [request.body];
	}
}

