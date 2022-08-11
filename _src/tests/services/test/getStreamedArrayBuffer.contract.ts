import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../objects';

@RequestType({
	responseType: ArrayBuffer,
	scope: 'public'
})
export class TestGetStreamedArrayBufferRequest extends ServiceRequestBase<void, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';
}
