import { ServiceExecutor } from '../../..';
import { PrivateStuffRequest, PrivateStuffResponse } from './privateStuff.contract';

export default class PrivateStuffExecutor implements ServiceExecutor<PrivateStuffRequest, PrivateStuffResponse> {
	static serviceName: string = 'NocatSelf.PrivateStuff';

	async execute(request: PrivateStuffRequest): Promise<PrivateStuffResponse> {
		return new PrivateStuffResponse(request.body + 1);
	}
}

