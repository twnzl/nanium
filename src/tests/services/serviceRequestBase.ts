import { ServiceRequestHead } from './serviceRequestHead';
import { ServiceResponseBase } from './serviceResponseBase';
import { Nocat } from '../../core';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry';
import { ServiceRequestContext } from './serviceRequestContext';
import { MyServiceRequestQueueEntry } from './serviceRequestQueueEntry';
import { Observable } from 'rxjs';

// @addTypeInfo
export class ServiceRequestBase<TRequestBody, TResponseBody, TPartialResponse = any> {

	// @Type(() => ServiceRequestHead)
	head: ServiceRequestHead;

	// @Type(() => Test2Dto)
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body;
		this.head = head;
	}

	async execute(context: ServiceRequestContext): Promise<ServiceResponseBase<TResponseBody>> {
		return await Nocat.execute(this, undefined, context);
	}

	stream(): Observable<TPartialResponse> {
		return Nocat.stream(this);
	}

	async enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nocat.enqueue(
			<MyServiceRequestQueueEntry>{ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId });
	}
}
