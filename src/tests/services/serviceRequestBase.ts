import { ServiceRequestHead } from './serviceRequestHead';
import { ServiceResponseBase } from './serviceResponseBase';
import { Nocat, ServiceRequest } from '../..';

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
}
