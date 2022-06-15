import { ServiceRequestHead } from './serviceRequestHead';
import { Type } from '../../objects';
import { ExecutionContext } from '../../interfaces/executionContext';
import { Nanium } from '../../core';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry';

export class ServiceRequestBase<TRequestBody, TResponse> {

	@Type(ServiceRequestHead)
	head?: ServiceRequestHead;

	@Type('TRequestBody')
	body: TRequestBody;

	constructor(body?: Partial<TRequestBody>, head?: ServiceRequestHead) {
		this.body = body as TRequestBody;
		this.head = head;
	}

	async execute(context?: ExecutionContext): Promise<TResponse> {
		return await Nanium.execute(this, undefined, context);
	}

	async enqueue(options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue({ serviceName, request: this, ...options });
	}
}
