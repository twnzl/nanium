import { AnonymousRequest } from './anonymous.contract';
import { ServiceResponseBase } from '../serviceResponseBase';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class AnonymousExecutor implements ServiceExecutor<AnonymousRequest, ServiceResponseBase<string>> {
	static serviceName: string = 'NaniumSelf.Anonymous';

	async execute(request: AnonymousRequest): Promise<ServiceResponseBase<string>> {
		return { body: ':-)' };
	}
}

