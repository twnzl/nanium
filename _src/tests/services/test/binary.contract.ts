import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../objects';

@RequestType({
	responseType: Buffer,
	scope: 'public'
})
export class TestBinaryRequest extends ServiceRequestBase<void, Buffer> {
	static serviceName: string = 'NaniumTest:test/binary';
}
