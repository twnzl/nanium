export class ServiceResponseBase<TResponseBody> {
	head?: ServiceResponseHead;
	body?: TResponseBody;

	constructor(body: TResponseBody) {
		this.body = body;
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
