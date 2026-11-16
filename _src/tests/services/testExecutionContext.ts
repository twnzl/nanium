import { ExecutionContext } from '../../interfaces/executionContext.js';
import { ExecutionScope } from '../../interfaces/executionScope.js';

export class TestExecutionContext implements ExecutionContext {
	scope?: ExecutionScope;
	user?: string;
	tenant?: string;

	constructor(data: Partial<TestExecutionContext>) {
		Object.assign(this, data);
	}
}
