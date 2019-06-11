import Nocat from '../core';

export default class ServiceRequestBase<TRequest, TResponse> {

	constructor(request: Partial<TRequest>) {
		Object.assign(this, request);
	}

	async execute(): Promise<TResponse> {
		return await Nocat.execute(this);
	}
}
