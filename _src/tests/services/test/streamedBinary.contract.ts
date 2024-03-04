import { RequestType } from '../../../objects';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

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
