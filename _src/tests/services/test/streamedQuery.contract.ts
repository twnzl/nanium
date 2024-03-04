import { RequestType } from '../../../objects';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { TestDto } from './query.contract';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase';

export class TestStreamedQueryRequestBody {
	amount?: number;
	msGapTime?: number;
}

@RequestType({
	responseType: [NaniumStream, TestDto],
	scope: 'public'
})
export class TestStreamedQueryRequest extends SimpleServiceRequestBase<TestStreamedQueryRequestBody, NaniumStream<TestDto>> {
	static serviceName: string = 'NaniumTest:test/streamedQuery';
}
