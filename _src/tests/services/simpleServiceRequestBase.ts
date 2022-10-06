import { ServiceRequestHead } from './serviceRequestHead';
import { ConstructorType, NaniumObject, Type } from '../../objects';
import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry';


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
