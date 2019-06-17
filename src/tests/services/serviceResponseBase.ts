export class ServiceResponseBase<TResponseBody> {
	head?: ServiceResponseHead;
	body?: TResponseBody;

	constructor(body: TResponseBody, head?: ServiceResponseHead) {
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

export class ServiceResponseHead {
	errors?: ServiceResponseMessage[];
	exceptions?: ServiceResponseMessage[];
}

export class ServiceResponseMessage {
	constructor(
		public code?: string,
		public text?: string
	) {
	}
}
