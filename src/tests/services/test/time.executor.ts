import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';
import { TimeRequest } from './time.contract.js';
import { ServiceResponseBase } from '../serviceResponseBase.js';

export class TestTimeExecutor implements ServiceExecutor<TimeRequest, ServiceResponseBase<Date>> {
	static serviceName: string = 'NaniumTest:test/time';

	async execute(request: TimeRequest): Promise<ServiceResponseBase<Date>> {
		return new ServiceResponseBase(request.body ?? undefined);
	}
}

