import { ExecutionScope } from './executionScope.js';
export interface ExecutionContext {
    scope?: ExecutionScope;
    source?: string;
}
