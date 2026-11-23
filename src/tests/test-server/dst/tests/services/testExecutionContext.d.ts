import { ExecutionContext } from '../../interfaces/executionContext.js';
import { ExecutionScope } from '../../interfaces/executionScope.js';
export declare class TestExecutionContext implements ExecutionContext {
    scope?: ExecutionScope;
    user?: string;
    tenant?: string;
    constructor(data: Partial<TestExecutionContext>);
}
