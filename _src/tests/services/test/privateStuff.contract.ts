import { ServiceRequestBase } from '../serviceRequestBase.js';
import { ServiceResponseBase } from '../serviceResponseBase.js';
import { RequestType } from '../../../objects.js';

@RequestType({
	responseType: ServiceResponseBase,
	scope: 'private'
})
export class PrivateStuffRequest extends ServiceRequestBase<number, number> {
	static serviceName: string = 'NaniumTest:test/privateStuff';

	validate(): any[] {
		if (this.body === 100) {
			return ['100 not allowed'];
		}
	}
}

export class PrivateStuffResponse extends ServiceResponseBase<number> {
}
