import { ServiceRequestBase } from '../../services/serviceRequestBase';
import { ServiceResponseBase } from '../../services/serviceResponseBase';
import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';

export class Test2GetRequest extends ServiceRequestBase<Test2GetRequestBody, Test2GetResponseBody> {
	static serviceName: string = 'NocatOther.Test2Get';
	static scope: ServiceExecutionScope = 'public';
	static skipInterceptors: boolean = false;
}

export class Test2GetRequestBody {
	i1: string;
	i2?: number;
}

export class Test2GetResponse extends ServiceResponseBase<Test2GetResponseBody> {
}

export class Test2GetResponseBody {
	o1: string;
	o2: number;
}

