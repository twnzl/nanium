import { RequestType } from '../../../objects.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase.js';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer.js';

export class TestStreamedBinaryRequestBody {
	amount?: number;
	msGapTime?: number;
}

@RequestType({
	responseType: [NaniumStream, NaniumBuffer],
	scope: 'public'
})
export class TestStreamedBinaryRequest extends SimpleServiceRequestBase<TestStreamedBinaryRequestBody, NaniumStream<NaniumBuffer>> {
	static serviceName: string = 'NaniumTest:test/streamedBinary';
}
