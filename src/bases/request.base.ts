import Nocat from '../core';
import {ServiceResponseBase} from './response.base';

export class ServiceRequestBase<TRequestBody, TResponseBody> {
	head: ServiceRequestHead;
	body: TRequestBody;

	constructor(body: TRequestBody) {
		this.body = body;
	}

	async execute(): Promise<ServiceResponseBase<TResponseBody>> {
		return await Nocat.execute(this);
	}
}

export class ServiceRequestHead {
	apiVersion: string;
}
