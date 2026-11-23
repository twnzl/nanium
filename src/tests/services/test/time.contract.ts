import { ServiceRequestBase } from '../serviceRequestBase.js';
import { ServiceResponseBase } from '../serviceResponseBase.js';
import { RequestType } from '../../../objects.js';

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
