import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../objects';

@RequestType({
	responseType: Number,
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
