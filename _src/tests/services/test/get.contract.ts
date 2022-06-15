import { ServiceRequestBase } from '../serviceRequestBase';
import { NaniumObject, RequestType } from '../../../objects';

export class TestGetResponse extends NaniumObject<TestGetResponse> {
	output1: string;
	output2: number;
}

export class TestGetRequestBody {
	input1: string;
	input2?: number;
}

@RequestType({
	responseType: TestGetResponse,
	genericTypes: { TRequestBody: TestGetRequestBody },
	scope: 'public'
})
export class TestGetRequest extends ServiceRequestBase<TestGetRequestBody, TestGetResponse> {
	static serviceName: string = 'NaniumTest:test/get';
}
