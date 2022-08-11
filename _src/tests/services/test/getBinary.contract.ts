import { RequestType } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';

@RequestType({
	responseType: ArrayBuffer,
	scope: 'public'
})
export class TestGetBinaryRequest extends SimpleServiceRequestBase<void, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';
}
