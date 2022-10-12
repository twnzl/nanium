import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../objects';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetStreamedArrayBufferRequest extends ServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';
}
