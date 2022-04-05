import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../serializers/core';
import { ServiceResponseBase } from '../serviceResponseBase';

@RequestType({
	responseType: ServiceResponseBase,
	genericTypes: {
		TRequestBody: Date,
		TResponseBody: Date
	},
	scope: 'public'
})
export class TimeRequest extends ServiceRequestBase<Date, Date> {
	static serviceName: string = 'NaniumTest:test/time';
}
