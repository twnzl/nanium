import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../..';
import { ServiceResponseBase } from '../serviceResponseBase';

export class PrivateStuffRequest extends ServiceRequestBase<number, number> {
	static serviceName: string = 'PrivateStuff';
	static scope: ServiceExecutionScope = ServiceExecutionScope.private;
}


export class PrivateStuffResponse extends ServiceResponseBase<number> {
}
