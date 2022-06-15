import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { TimeRequest } from './time.contract';

export class TestTimeExecutor implements ServiceExecutor<TimeRequest, Date> {
	static serviceName: string = 'NaniumTest:test/time';

	async execute(request: TimeRequest): Promise<Date> {
		return request.body ?? undefined;
	}
}

