import { ServiceResponseInterceptor } from '../../../interfaces/serviceResponseInterceptor.js';
import { ServiceRequestBase } from '../../services/serviceRequestBase.js';
import { TestGetRequest, TestGetResponse } from '../../services/test/get.contract.js';

export class TestClientResponseInterceptor implements ServiceResponseInterceptor<ServiceRequestBase<any, any>, any> {
	static responseCnt: number = 0;

	async execute(request: any, response: any): Promise<any> {
		TestClientResponseInterceptor.responseCnt++;
		if (request.constructor.serviceName === TestGetRequest.serviceName) {
			const rq: TestGetRequest = request;
			if (rq.body?.input1 === 'TestResponseInterceptor:ReturnDifferentResponse') {
				return new TestGetResponse({
					output1: 'ResultFromInterceptor'
				});
			} else if (rq.body?.input1 === 'TestResponseInterceptor:ReturnSameResponseInstance') {
				return response;
			} else if (rq.body?.input1 === 'TestResponseInterceptor:ReturnUndefined') {
				return undefined;
			} else if (rq.body?.input1 === 'TestResponseInterceptor:ReturnNull') {
				return null;
			}
		}
	}
}
