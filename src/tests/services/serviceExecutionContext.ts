import { ServiceExecutionContext } from 'nocat/interfaces/serviceExecutionContext';
import { ServiceExecutionScope } from 'nocat/interfaces/serviceExecutionScope';

export class TestExecutionContext implements ServiceExecutionContext {
	scope?: ServiceExecutionScope;
}
