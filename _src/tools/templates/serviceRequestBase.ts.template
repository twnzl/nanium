import { Nanium } from 'nanium/core';
import { ServiceRequestQueueEntry } from 'nanium/interfaces/serviceRequestQueueEntry';
import { ServiceRequestHead } from './serviceRequestHead';
import { Type } from 'nanium/serializers/core';
import { ExecutionContext } from 'nanium/interfaces/executionContext';

export class ServiceRequestBase<TRequestBody, TResponse> {

	@Type(ServiceRequestHead)
	head?: ServiceRequestHead;

	@Type('TRequestBody')
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body || {} as TRequestBody;
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
