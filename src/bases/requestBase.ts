import { serviceNameSymbol } from '../symbols';

export default class RequestBase {
	constructor(request?: RequestBase) {
		// determine service name
		// @ts-ignore
		this[serviceNameSymbol] = this.constructor.name.replace(/Request$/g, '');

		// init properties
		if (request) {
			Object.assign(this, request);
		}
	}
}
