import { Stuff, StuffRequest } from './stuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { ServiceExecutionContext } from '../../../interfaces/serviceExecutionContext';
import { ServiceRequestHead } from '../serviceRequestHead';

export class StuffExecutor implements ServiceExecutor<StuffRequest, Stuff<Date>[]> {
	static serviceName: string = 'NocatSelf.Stuff';

	async execute(request: StuffRequest, context?: ServiceExecutionContext): Promise<Stuff<Date>[]> {
		if (!(request instanceof StuffRequest)) {
			throw new Error('request is not an instance of StuffRequest');
		}
		if (!(request.body instanceof Stuff)) {
			throw new Error('request.body is not an instance of Stuff');
		}
		if (!(request.head instanceof ServiceRequestHead)) {
			throw new Error('request.head is not an instance of ServiceRequestHead');
		}
		return [request.body];
	}
}

