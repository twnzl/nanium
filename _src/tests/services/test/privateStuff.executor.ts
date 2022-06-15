import { PrivateStuffRequest } from './privateStuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class PrivateStuffExecutor implements ServiceExecutor<PrivateStuffRequest, number> {
	static serviceName: string = 'NaniumTest:test/privateStuff';

	async execute(request: PrivateStuffRequest): Promise<number> {
		const errors: string[] = request.validate();
		if (errors?.length) {
			throw errors;
		}
		return request.body + 1;
	}
}

