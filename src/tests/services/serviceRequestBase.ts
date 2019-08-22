import { ServiceRequestHead } from './serviceRequestHead';
import { Nocat, ServiceRequest } from '../..';
import { ServiceResponseBase } from './serviceResponseBase';

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
