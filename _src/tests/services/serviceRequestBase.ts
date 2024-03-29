import { ServiceRequestHead } from './serviceRequestHead';
import { ServiceResponseBase } from './serviceResponseBase';
import { Nanium } from '../../core';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry';
import { TestExecutionContext } from './testExecutionContext';
import { MyServiceRequestQueueEntry } from './serviceRequestQueueEntry';
import { Observable } from 'rxjs';
import { ConstructorType, NaniumObject, Type } from '../../objects';

export class ServiceRequestBase<TRequestBody, TResponseBody, TPartialResponse = any> {

	@Type(ServiceRequestHead) head: ServiceRequestHead;
	@Type('TRequestBody') body: TRequestBody;

	// if body is not Partial<> here, typescript will complain if you do not set the properties of
	// functions and getters/setters
	constructor(body?: Partial<TRequestBody>, head?: Partial<ServiceRequestHead>) {
		this.body = body ? NaniumObject.create(body, 'TRequestBody', (this as object).constructor as ConstructorType) : undefined;
		this.head = head ? new ServiceRequestHead(head) : undefined;
	}

	async execute(context?: TestExecutionContext): Promise<ServiceResponseBase<TResponseBody>> {
		return await Nanium.execute(this, undefined, context);
	}

	stream<TResult>(): Observable<TPartialResponse> {
		return Nanium.stream(this);
	}

	async enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue(
			<MyServiceRequestQueueEntry>{ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId });
	}
}
