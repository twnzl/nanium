import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class PrivateStuffRequest extends ServiceRequestBase<number, number> {
	static serviceName: string = 'NocatSelf.PrivateStuff';
	static scope: ServiceExecutionScope = 'private';

	validate(): any[] {
		if (this.body === 100) {
			return ['100 not allowed'];
		}
	}
}


export class PrivateStuffResponse extends ServiceResponseBase<number> {
}
