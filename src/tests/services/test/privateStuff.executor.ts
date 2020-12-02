import { PrivateStuffRequest, PrivateStuffResponse } from './privateStuff.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export default class PrivateStuffExecutor implements ServiceExecutor<PrivateStuffRequest, PrivateStuffResponse> {
	static serviceName: string = 'NocatSelf.PrivateStuff';

	async execute(request: PrivateStuffRequest): Promise<PrivateStuffResponse> {
		const errors: string[] = request.validate();
		if (errors?.length) {
			throw errors;
		}
		return new PrivateStuffResponse(request.body + 1);
	}
}

