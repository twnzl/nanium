import NocatServer from "../server";
import TestRequest from "./services/contracts/test.request";

NocatServer.init('services/executors').then(() => {
	new TestRequest({	input1: 'hello world' }).execute()
		.then((result: any) => {
			console.log(result);
			process.exit(0);
		});
});
