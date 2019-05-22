import {RequestBase} from "./baseClasses/requestBase";
import {ResponseBase} from "./server";

export default class NocatClient {

	static async execute(serviceName: string, request: RequestBase): Promise<ResponseBase> {
		return {}
	}
}
