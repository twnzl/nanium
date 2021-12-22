import { GenericType, Type } from '../../serializers/core';

export class ServiceResponseMessage {
	constructor(
		public code?: string,
		public text?: string
	) {
	}
}

export class ServiceResponseHead {
	@Type(ServiceResponseMessage)
	errors?: ServiceResponseMessage[];

	@Type(ServiceResponseMessage)
	exceptions?: ServiceResponseMessage[];
}

export class ServiceResponseBase<TResponseBody> {
	@Type(ServiceResponseHead)
	head?: ServiceResponseHead;

	@GenericType('TResponseBody')
	body?: TResponseBody;

	constructor(body?: TResponseBody, head?: ServiceResponseHead) {
		this.body = body;
		this.head = head;
	}

	static createError(code: string, text?: string): ServiceResponseBase<any> {
		return new ServiceResponseBase<any>(
			undefined, {
				errors: [{
					code: code,
					text: text
				}]
			});
	}
}

