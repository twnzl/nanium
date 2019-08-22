import { ServiceExecutor } from '../../..';
import { PrivateStuffRequest } from './privateStuff.contract';

export default class PrivateStuffExecutor implements ServiceExecutor<PrivateStuffRequest, number> {
	static serviceName: string = 'PrivateStuff';

	async execute(request: PrivateStuffRequest): Promise<number> {
		return request.body++;
	}
}

