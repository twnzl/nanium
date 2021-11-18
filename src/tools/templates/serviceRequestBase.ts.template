import { Nanium } from 'nanium/core';
import { ServiceExecutionContext } from 'nanium/interfaces/serviceExecutionContext';
import { ServiceRequestQueueEntry } from 'nanium/interfaces/serviceRequestQueueEntry';
import { ServiceRequestHead } from './serviceRequestHead';
import { GenericType, Type } from 'nanium/serializers/core';

export class ServiceRequestBase<TRequestBody, TResponse> {

	@Type(ServiceRequestHead)
	head?: ServiceRequestHead;

	@GenericType('TRequestBody')
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body || {} as TRequestBody;
		this.head = head;
	}

	async execute(context?: ServiceExecutionContext): Promise<TResponse> {
		return await Nanium.execute(this, undefined, context);
	}

	async enqueue(options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue({ serviceName, request: this, ...options });
	}
}
