import { NocatServer } from '../managers/server';
import { Nocat } from '../core';
import { TestQueryRequest, TestQueryResponse } from './services/test/query.contract';

Nocat.init(new NocatServer({
	servicePath: '../services',
	// requestInterceptors: [new TestRequestInterceptor()]
})).then(() => {
	new TestQueryRequest({ input1: 'hello world' }).execute()
		.then((result: TestQueryResponse) => {
			console.log(result);
			process.exit(0);
		});
});
