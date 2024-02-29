import { ExecutionContext } from '../../interfaces/executionContext';
import { ExecutionScope } from '../../interfaces/executionScope';

export class TestExecutionContext implements ExecutionContext {
	scope?: ExecutionScope;
	user?: string;
	tenant?: string;

	constructor(data: Partial<TestExecutionContext>) {
		Object.assign(this, data);
	}
}
