import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { RequestType } from '../../../serializers/core';

@RequestType({
	responseType: ServiceResponseBase,
	scope: 'private'
})
export class PrivateStuffRequest extends ServiceRequestBase<number, number> {
	static serviceName: string = 'NocatSelf.PrivateStuff';

	validate(): any[] {
		if (this.body === 100) {
			return ['100 not allowed'];
		}
	}
}

export class PrivateStuffResponse extends ServiceResponseBase<number> {
}
