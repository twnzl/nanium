import { AnonymousRequest } from './anonymous.contract.js';
import { ServiceResponseBase } from '../serviceResponseBase.js';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor.js';

export class AnonymousExecutor implements ServiceExecutor<AnonymousRequest, ServiceResponseBase<string>> {
	static serviceName: string = 'NaniumTest:test/anonymous';

	async execute(request: AnonymousRequest): Promise<ServiceResponseBase<string>> {
		return { body: ':-)' };
	}
}

