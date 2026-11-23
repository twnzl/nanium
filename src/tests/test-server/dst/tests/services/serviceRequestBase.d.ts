import { ServiceRequestHead } from './serviceRequestHead.js';
import { ServiceResponseBase } from './serviceResponseBase.js';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry.js';
import { TestExecutionContext } from './testExecutionContext.js';
export declare class ServiceRequestBase<TRequestBody, TResponseBody, TPartialResponse = any> {
    head: ServiceRequestHead;
    body: TRequestBody;
    constructor(body?: Partial<TRequestBody>, head?: Partial<ServiceRequestHead>);
    execute(context?: TestExecutionContext): Promise<ServiceResponseBase<TResponseBody>>;
    enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry>;
}
