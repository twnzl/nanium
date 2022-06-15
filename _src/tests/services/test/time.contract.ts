import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from '../../../objects';

@RequestType({
	responseType: Date,
	genericTypes: { TRequestBody: Date },
	scope: 'public'
})
export class TimeRequest extends ServiceRequestBase<Date, Date> {
	static serviceName: string = 'NaniumTest:test/time';
}
