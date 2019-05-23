import NocatServer from '../../managers/server';
import TestRequest from '../services/contracts/test.request';
import Nocat from '../../core';

Nocat.init(new NocatServer('../services/executors')).then(() => {
	new TestRequest('hello world').execute()
		.then((result: any) => {
			console.log(result);
			process.exit(0);
		});
});
