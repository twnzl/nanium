import { RequestType } from '../../../objects';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetNaniumBufferRequest extends SimpleServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getNaniumBuffer';
}
