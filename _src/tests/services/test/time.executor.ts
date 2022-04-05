import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TimeRequest } from './time.contract';
import { ServiceResponseBase } from '../serviceResponseBase';

export class TestTimeExecutor implements ServiceExecutor<TimeRequest, ServiceResponseBase<Date>> {
	static serviceName: string = 'NaniumTest:test/time';

	async execute(request: TimeRequest): Promise<ServiceResponseBase<Date>> {
		return new ServiceResponseBase(request.body ?? undefined);
	}
}

