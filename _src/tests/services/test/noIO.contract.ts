import { RequestType } from '../../../objects';
import { ServiceRequestBase } from '../serviceRequestBase';

@RequestType({
	scope: 'public'
})
export class TestNoIORequest extends ServiceRequestBase<void, void> {
	public static serviceName: string = 'NaniumTest:test/noIO';
}
