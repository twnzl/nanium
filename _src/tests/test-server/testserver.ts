import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { NaniumJsonSerializer } from '../../serializers/json';
import { Nanium } from '../../core';
import { NaniumProviderNodejs } from '../../managers/providers/nodejs';
import { NaniumHttpChannel } from '../../managers/providers/channels/http';
import * as path from 'path';
import { TestServerRequestInterceptor } from '../interceptors/server/test.request.interceptor';
import * as cluster from 'cluster';
import { ClusterCommunicator } from '../../communicators/clusterCommunicator';
import { TestEventEmissionSendInterceptor } from '../interceptors/server/test.send-event-emission.interceptor';
import {
	TestEventSubscriptionReceiveInterceptor
} from '../interceptors/server/test.receive-event-subscription.interceptor';

async function runPrimary(workerCount: number) {
	console.log(`Primary ${process.pid} is running`);

	for (let i = 0; i < workerCount; i++) {
		cluster.fork();
	}

	Nanium.communicators = [new ClusterCommunicator()];

	cluster.on('exit', (worker) => {
		console.log(`worker ${worker.process.pid} died`);
	});
}

async function runWorker() {
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
		} else if (!req.url.startsWith('/api') && !req.url.startsWith('/events')) {
			res.statusCode = 200;
			res.write('*** http fallback ***');
			res.end();
			return;
		}
		//#endregion route to check if server is running
	});
	// each worker has its own port, just du make sure to connect to different processes in the tests
	const port = cluster.worker.id % 2 === 0 ? 8080 : 8081;
	httpServer.listen(port);
	console.log(`Worker ${process.pid} is listening on port ${port}`);

	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';

	Nanium.communicators = [new ClusterCommunicator()];

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
		eventEmissionSendInterceptors: [TestEventEmissionSendInterceptor],
		eventSubscriptionReceiveInterceptors: [TestEventSubscriptionReceiveInterceptor],
		handleError: handleError,
	}));
}

async function run(workerCount: number = 2) {
	if (cluster.isMaster) {
		await runPrimary(workerCount);
	} else {
		await runWorker();
	}
}

async function handleError(error: any): Promise<void> {
	throw error;
}

run().then();
