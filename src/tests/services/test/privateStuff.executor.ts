import { PrivateStuffRequest, PrivateStuffResponse } from './privateStuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class PrivateStuffExecutor implements ServiceExecutor<PrivateStuffRequest, PrivateStuffResponse> {
	static serviceName: string = 'NaniumSelf.PrivateStuff';

	async execute(request: PrivateStuffRequest): Promise<PrivateStuffResponse> {
		const errors: string[] = request.validate();
		if (errors?.length) {
			throw errors;
		}
		return new PrivateStuffResponse(request.body + 1);
	}
}

