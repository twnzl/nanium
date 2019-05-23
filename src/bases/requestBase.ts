import NocatServer from "../server";
import ResponseBase from "./responseBase";
import NocatClient from "../client";

const serviceNameSymbol: symbol = Symbol('serviceNameSymbol');

export class RequestBase {

	constructor(request?: RequestBase) {
		// determine service name
		this[serviceNameSymbol] = this.constructor.name.replace(/Request$/g, '');

		// init properties
		if (request) {
			Object.assign(this, request);
		}
	}

	async execute?<TResponse extends ResponseBase>(): Promise<TResponse> {
		if (typeof window === 'undefined') {
			return (await NocatServer.execute(this[serviceNameSymbol], this)) as TResponse;
		} else {
			return (await NocatClient.execute(this[serviceNameSymbol], this)) as TResponse;
		}
	}
}
