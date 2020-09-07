import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../..';
import { ServiceResponseBase } from '../serviceResponseBase';

export class PrivateStuffRequest extends ServiceRequestBase<number, number> {
	static serviceName: string = 'NocatSelf.PrivateStuff';
	static scope: ServiceExecutionScope = ServiceExecutionScope.private;

	validate(): any[] {
		if (this.body === 100) {
			return ["100 not allowed"];
		}
	}
}


export class PrivateStuffResponse extends ServiceResponseBase<number> {
}
