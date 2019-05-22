import NocatServer, {ResponseBase} from "../server";

const serviceNameSymbol: symbol = Symbol('serviceNameSymbol');

export class RequestBase {

	constructor(request?: RequestBase) {
		// determine service name
		const ctorString: string = this.constructor.toString();
		// es6
		if (ctorString.startsWith('class')) {
			this[serviceNameSymbol] = ctorString.split(' ')[1];
		}
		// es5
		else {
			this[serviceNameSymbol] = ctorString.substring(6, ctorString.indexOf(' '));
		}

		this[serviceNameSymbol] = this[serviceNameSymbol].replace(/Request$/g, '');

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
