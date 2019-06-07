export class ServiceResponseBase<TResponseBody> {
	head: ServiceResponseHead;
	body: TResponseBody;

	constructor(body: TResponseBody) {
		this.body = body;
	}
}

export class ServiceResponseHead {
	apiLocation: string;
}
