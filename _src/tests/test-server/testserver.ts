import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { NaniumJsonSerializer } from '../../serializers/json';
import { Nanium } from '../../core';
import { NaniumProviderNodejs } from '../../managers/providers/nodejs';
import { NaniumHttpChannel } from '../../managers/providers/channels/http';
import * as path from 'path';
import { TestServerRequestInterceptor } from '../interceptors/server/test.request.interceptor';

async function run() {
	const httpServer: http.Server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
		//#region CORS
		res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
		res.setHeader('AMP-Access-Control-Allow-Source-Origin', req.headers.origin ?? '*');
		res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
		if (req.method === 'OPTIONS') {
			res.statusCode = 200;
			res.end();
			return;
		}
		//#endregion CORS

		//#region route to check if server is running
		if (req.url === '/ready') {
			res.statusCode = 200;
			res.write('yes');
			res.end();
			return;
		} else if (!req.url.startsWith('/api')) {
			res.statusCode = 200;
			res.write('*** http fallback ***');
			res.end();
			return;
		}
		//#endregion route to check if server is running
	});
	httpServer.listen(8080);

	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';

	await Nanium.addManager(new NaniumProviderNodejs({
		servicePath: path.resolve(path.join(__dirname, '..', '..', '..', '..', '..', '..', 'tests', 'services')),
		channels: [
			new NaniumHttpChannel({
				apiPath: '/api',
				eventPath: '/events',
				server: httpServer,
				serializer: serializer,
			}),
		],
		requestInterceptors: [TestServerRequestInterceptor],
		handleError: handleError,
	}));
}

async function handleError(error: any): Promise<void> {
	throw error;
}

run();
