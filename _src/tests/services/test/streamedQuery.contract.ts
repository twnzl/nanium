import { RequestType } from '../../../objects';
import { NaniumStream } from '../../../interfaces/naniumStream';
import { TestDto } from './query.contract';
import { ServiceRequestBase } from '../serviceRequestBase';

@RequestType({
	responseType: NaniumStream,
	scope: 'public'
})
export class TestStreamedQueryRequest extends ServiceRequestBase<number, NaniumStream<TestDto>> {
	static serviceName: string = 'NaniumTest:test/streamedQuery';
}
