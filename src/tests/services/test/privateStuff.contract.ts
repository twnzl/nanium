import { ServiceRequestBase } from '../serviceRequestBase';
import { ServiceExecutionScope } from '../../..';

export class PrivateStuffRequest extends ServiceRequestBase<number, void> {
	static serviceName: string = 'PrivateStuff';
	static scope: ServiceExecutionScope = ServiceExecutionScope.private;
}
