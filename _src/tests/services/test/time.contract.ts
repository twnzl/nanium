import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceResponseBase } from '../serviceResponseBase';
import { RequestType } from '../../../objects';

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
