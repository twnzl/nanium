import { ServiceRequestHead } from './serviceRequestHead.js';
import { ServiceResponseBase } from './serviceResponseBase.js';
import { Nanium } from '../../core.js';
import { ServiceRequestQueueEntry } from '../../interfaces/serviceRequestQueueEntry.js';
import { TestExecutionContext } from './testExecutionContext.js';
import { MyServiceRequestQueueEntry } from './serviceRequestQueueEntry.js';
import { ConstructorType, NaniumObject, Type } from '../../objects.js';

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

	async enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue(
			<MyServiceRequestQueueEntry>{ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId });
	}
}
