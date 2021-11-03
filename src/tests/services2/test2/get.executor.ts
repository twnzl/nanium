import { ServiceResponseMessage } from '../../services/serviceResponseBase';
import { Test2GetRequest, Test2GetResponse } from './get.contract';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';

export default class Test2GetExecutor implements ServiceExecutor<Test2GetRequest, Test2GetResponse> {
	static serviceName: string = 'NocatOther.Test2Get';

	async execute(request: Test2GetRequest): Promise<Test2GetResponse> {
		if (request.body.i2 === 5) {
			throw new Error('no!');
		}
		if (request.body.i2 === 4) {
			throw new ServiceResponseMessage('E2', 'Error 2');
		}
		if (request.body.i2 === 10) {
			throw new Error('no no!');
		}
		return new Test2GetResponse({
			o1: request.body.i1 + ' :-)',
			o2: 2
		});
	}
}

