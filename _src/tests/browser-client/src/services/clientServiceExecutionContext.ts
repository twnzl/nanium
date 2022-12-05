import { ExecutionContext } from '../../../../interfaces/executionContext';
import { ExecutionScope } from '../../../../interfaces/executionScope';
import { NaniumObject } from '../../../../objects';


export class ClientServiceExecutionContext implements ExecutionContext {
	scope?: ExecutionScope;
	user: { name: string; id: number };

	constructor(data: Partial<ClientServiceExecutionContext>) {
		NaniumObject.init(this, data);
	}
}
