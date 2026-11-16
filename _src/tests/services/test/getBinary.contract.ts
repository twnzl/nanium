import { RequestType } from '../../../objects.js';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase.js';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';

@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetBinaryRequest extends SimpleServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';
}
