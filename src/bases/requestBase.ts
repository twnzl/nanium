import { serviceNameSymbol } from '../symbols';

export default class RequestBase {

	constructor(request?: RequestBase) {
		// determine service name
		this[serviceNameSymbol] = this.constructor.name.replace(/Request$/g, '');

		// init properties
		if (request) {
			Object.assign(this, request);
		}
	}
}
