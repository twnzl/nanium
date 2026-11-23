import { RequestType } from '../../../objects.js';
import { ServiceRequestBase } from '../serviceRequestBase.js';

@RequestType({
	scope: 'public'
})
export class TestNoIORequest extends ServiceRequestBase<void, void> {
	public static serviceName: string = 'NaniumTest:test/noIO';
}
