import { ConstructorType, NaniumObject, Type } from '../../../../objects';
import { ExecutionContext } from '../../../../interfaces/executionContext';
import { Nanium } from '../../../../core';
import { ServiceRequestQueueEntry } from '../../../../interfaces/serviceRequestQueueEntry';

export class ClientServiceRequestBase<TRequestBody, TResponse> {

	@Type('TRequestBody') body: TRequestBody;

	constructor(body?: TRequestBody) {
		this.body = body ? NaniumObject.create(body, 'TRequestBody', this.constructor as ConstructorType) : {} as TRequestBody;
	}

	async execute(context?: ExecutionContext): Promise<TResponse> {
		return await Nanium.execute(this, undefined, context);
	}

	async enqueue(options?: Partial<ServiceRequestQueueEntry>, context?: ExecutionContext): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nanium.enqueue(<ServiceRequestQueueEntry>{ serviceName, request: this, ...options }, context);
	}
}
