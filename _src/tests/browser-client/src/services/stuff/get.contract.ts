import { NaniumObject, RequestType, Type } from '../../../../../objects';
import { ClientServiceRequestBase } from '../clientServiceRequestBase';

export class StuffGetRequestBody extends NaniumObject<StuffGetRequestBody> {
	@Type(String) value: string;
}

export class StuffGetResponse extends NaniumObject<StuffGetResponse> {
	@Type(String) value: string;
}

@RequestType({
	responseType: StuffGetResponse,
	genericTypes: { TRequestBody: StuffGetRequestBody },
	scope: 'private'
})
export class StuffGetRequest extends ClientServiceRequestBase<StuffGetRequestBody, StuffGetResponse> {
	static serviceName: string = 'NaniumClientTest:stuff/get';
}
