import { ServiceRequestHead } from './serviceRequestHead';
import { ServiceResponseBase } from './serviceResponseBase';
import { ServiceRequest } from '../../interfaces/serviceRequest';
import { Nocat } from '../../core';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry';

export class ServiceRequestBase<TRequestBody, TResponseBody> implements ServiceRequest<ServiceResponseBase<TResponseBody>> {

	head: ServiceRequestHead;
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body;
		this.head = head;
	}

	async execute(): Promise<ServiceResponseBase<TResponseBody>> {
		return await Nocat.execute(this);
	}

	async enqueue(options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nocat.enqueue({ serviceName, request: this, ...options });
	}
}
