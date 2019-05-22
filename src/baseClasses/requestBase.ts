import NocatServer, {ResponseBase} from "../server";

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

	async execute?(): Promise<ResponseBase> {
		if (typeof window === 'undefined') {
			return await NocatServer.execute(this[serviceNameSymbol], this);
		} else {
			return {} // todo implement clientSite
		}
	}
}
