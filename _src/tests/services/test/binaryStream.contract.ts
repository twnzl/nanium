import { StreamServiceRequestBase } from '../streamServiceRequestBase';
import { RequestType } from '../../../objects';

@RequestType({
	responseType: Buffer,
	scope: 'public'
})
export class TestBinaryStreamRequest extends StreamServiceRequestBase<void, Buffer> {
	static serviceName: string = 'NaniumTest:test/binaryStream';
}
