import {RequestBase} from "./bases/requestBase";
import ResponseBase from "./bases/responseBase";

export default class NocatClient {

	static async execute(serviceName: string, request: RequestBase): Promise<ResponseBase> {
		alert(request);
		return {}
	}
}
