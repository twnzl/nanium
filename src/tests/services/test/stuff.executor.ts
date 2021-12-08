import { Stuff, StuffRequest } from './stuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { ExecutionContext } from '../../../interfaces/executionContext';
import { ServiceRequestHead } from '../serviceRequestHead';

export class StuffExecutor implements ServiceExecutor<StuffRequest, Stuff<Date>[]> {
	static serviceName: string = 'NaniumTest:test/stuff';

	async execute(request: StuffRequest, context?: ExecutionContext): Promise<Stuff<Date>[]> {
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

