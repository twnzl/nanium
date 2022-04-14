import { ConstructorType, NaniumObject, Type } from '../../objects';

export class ServiceResponseMessage {
	constructor(
		public code?: string,
		public text?: string
	) {
	}
}

export class ServiceResponseHead extends NaniumObject<ServiceResponseHead> {
	@Type(ServiceResponseMessage) errors?: ServiceResponseMessage[];
	@Type(ServiceResponseMessage) exceptions?: ServiceResponseMessage[];
}

export class ServiceResponseBase<TResponseBody> {
	@Type(ServiceResponseHead) head?: ServiceResponseHead;
	@Type('TResponseBody') body?: TResponseBody;

	constructor(body?: TResponseBody, head?: ServiceResponseHead) {
		this.body = NaniumObject.create(body, 'TResponseBody', (this as object).constructor as ConstructorType) as TResponseBody;
		this.head = new ServiceResponseHead(head);
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

