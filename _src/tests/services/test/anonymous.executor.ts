import { AnonymousRequest } from './anonymous.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export class AnonymousExecutor implements ServiceExecutor<AnonymousRequest, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';

	async execute(request: AnonymousRequest): Promise<string> {
		return ':-)';
	}
}

