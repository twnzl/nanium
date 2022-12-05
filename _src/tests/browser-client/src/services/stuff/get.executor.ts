import { StuffGetRequest, StuffGetResponse } from './get.contract';
import { ServiceExecutor } from '../../../../../interfaces/serviceExecutor';
import { ClientServiceExecutionContext } from '../clientServiceExecutionContext';

export class StuffGetExecutor implements ServiceExecutor<StuffGetRequest, StuffGetResponse> {
	static serviceName: string = 'NaniumClientTest:stuff/get';

	async execute(request: StuffGetRequest, executionContext: ClientServiceExecutionContext): Promise<StuffGetResponse> {
		return new StuffGetResponse({ value: executionContext.user.name });
	}
}
