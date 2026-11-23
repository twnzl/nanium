import { RequestType } from '../../../objects.js';
import { NaniumStream } from '../../../interfaces/naniumStream.js';
import { TestDto } from './contractparts.js';
import { SimpleServiceRequestBase } from '../simpleServiceRequestBase.js';

export class TestStreamedQueryRequestBody {
	amount?: number;
	msGapTime?: number;
}

@RequestType({
	responseType: [NaniumStream, TestDto],
	// genericTypes: {
	// 	TRequestBody: TestStreamedQueryRequestBody,
	// 	TResponseBody: [NaniumStream, TestDto]
	// },
	scope: 'public'
})
export class TestStreamedQueryRequest extends SimpleServiceRequestBase<TestStreamedQueryRequestBody, NaniumStream<TestDto>> {
	static serviceName: string = 'NaniumTest:test/streamedQuery';
}
