import NocatServer from '../../managers/server';
import Nocat from '../../core';
import {TestRequest, TestResponse} from '../services/contracts/test.contract';

Nocat.init(new NocatServer({
	executorsPath: '../services/executors',
	// requestInterceptors: [new TestRequestInterceptor()]
})).then(() => {
	new TestRequest({input1: 'hello world'}).execute()
		.then((result: TestResponse) => {
			console.log(result);
			process.exit(0);
		});
});
