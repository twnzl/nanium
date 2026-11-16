import { ServiceRequestHead } from './serviceRequestHead.js';
import { ConstructorType, NaniumObject, Type } from '../../objects.js';
import { ExecutionContext } from '../../interfaces/executionContext.js';
import { Nanium } from '../../core.js';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry.js';


export class SimpleServiceRequestBase<TRequestBody, TResponse> {

	@Type(ServiceRequestHead) head?: ServiceRequestHead;
	@Type('TRequestBody') body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body ? NaniumObject.create(body, 'TRequestBody', this.constructor as ConstructorType) : undefined;
		this.head = head ? new ServiceRequestHead(head) : undefined;
	}

	async execute(context?: ExecutionContext): Promise<TResponse> {
		return await Nanium.execute(this, undefined, context);
	}

	async enqueue(options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue({ serviceName, request: this, ...options });
	}
}
