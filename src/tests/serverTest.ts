import TestRequest from "./contracts/test.request";
import NocatServer from "../server";

NocatServer.init().then(() => {
	new TestRequest({	input1: 'hello world' }).execute()
		.then((result: any) => {
			console.log(result);
			process.exit(0);
		});
});
