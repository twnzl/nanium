import { ServiceExecutor } from '../../..';
import { AnonymousRequest } from './anonymous.contract';
import { ServiceResponseBase } from '../serviceResponseBase';

export default class AnonymousExecutor implements ServiceExecutor<AnonymousRequest, ServiceResponseBase<string>> {
	static serviceName: string = 'NocatSelf.Anonymous';

	async execute(request: AnonymousRequest): Promise<ServiceResponseBase<string>> {
		return { body: ':-)' };
	}
}

