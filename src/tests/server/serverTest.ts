import NocatServer from '../../managers/server';
import Nocat from '../../core';
import {TestRequest, TestResponseBody} from '../services/contracts/test.contract';
import {ServiceResponseBase} from '../../bases/response.base';

Nocat.init(new NocatServer({
	executorsPath: '../services/executors',
	// requestInterceptors: [new TestRequestInterceptor()]
})).then(() => {
	new TestRequest({input1: 'hello world'}).execute()
		.then((result: ServiceResponseBase<TestResponseBody>) => {
			console.log(result);
			process.exit(0);
		});
});
