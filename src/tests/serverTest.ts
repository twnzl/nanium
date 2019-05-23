import NocatServer from '../server';
import TestRequest from './services/contracts/test.request';

NocatServer.init('services/executors').then(() => {
	NocatServer.execute(new TestRequest({	input1: 'hello world' }))
		.then((result: any) => {
			console.log(result);
			process.exit(0);
		});
});
