import { RequestType } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetBinaryRequest extends SimpleServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';
}
