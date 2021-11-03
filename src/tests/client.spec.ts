import { Nocat } from '../core';
import { NocatNodejsProvider } from '../managers/providers/nodejs';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { LogMode } from '../interfaces/logMode';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';
import { ServiceRequestContext } from './services/serviceRequestContext';
import { NocatHttpChannel } from '../managers/providers/channels/http';
import * as http from 'http';
import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import * as https from 'https';
import { RequestOptions as HttpsRequestOptions, Server as HttpsServer } from 'https';
import { NocatConsumerNodejsHttp } from '../managers/consumers/nodejsHttp';
import { Test2GetRequest, Test2GetResponse } from './services2/test2/get.contract';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

const request: Test2GetRequest = new Test2GetRequest({ i1: 'hello world' }, { token: '1234' });
const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });
let response: Test2GetResponse;
let hasServerBeenCalled: boolean;
let httpServer: HttpServer;
let httpsServer: HttpsServer;

beforeAll(async function (): Promise<void> {
	// http server
	httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
		res.write('*** http fallback ***');
		res.statusCode = 200;
		res.end();
	});
	httpServer.listen(8888);

	// https server
	httpsServer = https.createServer({
			key: fs.readFileSync(path.join(__dirname, 'cert/dummy.key')),
			cert: fs.readFileSync(path.join(__dirname, 'cert/dummy.crt'))
		},
		(req: IncomingMessage, res: ServerResponse) => {
			res.write('*** https fallback ***');
			res.statusCode = 200;
			res.end();
		});
	httpsServer.listen(8889);
});

afterAll(async function (): Promise<void> {
	await httpServer.close();
	await httpsServer.close();
});

describe('host Test2Request via http \n', function (): void {

	beforeEach(async function (): Promise<void> {
		hasServerBeenCalled = false;
		await Nocat.addManager(new NocatNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services2',
			requestChannels: [
				new NocatHttpChannel({
					apiPath: '/api',
					server: httpServer,
					executionContextConstructor: ServiceRequestContext
				})
			],
			requestInterceptors: { test: TestServerRequestInterceptor },
			isResponsible: async (): Promise<KindOfResponsibility> => {
				if (!hasServerBeenCalled) {
					// the first Nocat.Execute will chose the consumer as the responsible manager, the second call from the
					// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
					hasServerBeenCalled = true;
					return 'no';
				} else {
					return 'yes';
				}
			},
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));

		await Nocat.addManager(new NocatConsumerNodejsHttp({
			apiUrl: 'http://localhost:8888/api',
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));
	});

	afterEach(async function (): Promise<void> {
		await Nocat.shutdown();
	});

	describe('execute request via the consumer\n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.i2 = null;
			response = await request.execute(executionContext);
		});

		it('--> the service should have been called via the http channel and should return the right result \n', async function (): Promise<void> {
			expect(response.body.o1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.o2, 'o2 should be correct').toBe(2);
		});
	});

	describe('call an url of the http server that is not managed by nocat \n', function (): void {
		let result: any;
		beforeEach(async function (): Promise<void> {
			result = await new Promise<any>(resolve => {
				http.get('http://localhost:8888/stuff', (res: IncomingMessage) => {
					let str: string = '';
					res.on('data', (chunk: string) => {
						str += chunk;
					});
					res.on('end', async () => {
						resolve(str);
					});
				});
			});
		});

		it('--> the original request listener of the server should have handled the request \n', async function (): Promise<void> {
			expect(result).toBe('*** http fallback ***');
		});
	});
});

describe('host Test2Request via https \n', function (): void {
	const request: Test2GetRequest = new Test2GetRequest({ i1: 'hello world' }, { token: '1234' });
	const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

	let response: Test2GetResponse;
	let hasServerBeenCalled: boolean;

	beforeEach(async function (): Promise<void> {
		hasServerBeenCalled = false;
		await Nocat.addManager(new NocatNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services2',
			requestChannels: [
				new NocatHttpChannel({
					apiPath: '/api',
					server: httpsServer,
					executionContextConstructor: ServiceRequestContext
				})
			],
			requestInterceptors: { test: TestServerRequestInterceptor },
			isResponsible: async (): Promise<KindOfResponsibility> => {
				if (!hasServerBeenCalled) {
					// the first Nocat.Execute will chose the consumer as the responsible manager, the second call from the
					// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
					hasServerBeenCalled = true;
					return 'no';
				} else {
					return 'yes';
				}
			},
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));

		await Nocat.addManager(new NocatConsumerNodejsHttp({
			apiUrl: 'https://localhost:8889/api',
			options: {
				rejectUnauthorized: false,
				timeout: 1000
			},
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('yes'),
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));
	});

	afterAll(async function (): Promise<void> {
		await httpsServer.close();
	});

	describe('execute request via the consumer\n', function (): void {
		beforeEach(async function (): Promise<void> {
			request.body.i2 = null;
			response = await request.execute(executionContext);
		});

		it('--> the service should have been called via the http channel and should return the right result \n', async function (): Promise<void> {
			expect(response.body.o1, 'o1 should be correct').toBe('hello world :-)');
			expect(response.body.o2, 'o2 should be correct').toBe(2);
		});
	});

	describe('call an url of the https server that is not managed by nocat \n', function (): void {
		let result: any;
		beforeEach(async function (): Promise<void> {
			result = await new Promise<any>(resolve => {
				const uri: URL = new URL('https://localhost:8889/stuff');
				const options: HttpsRequestOptions = {
					host: uri.hostname,
					path: uri.pathname,
					port: uri.port,
					method: 'POST',
					protocol: uri.protocol,
					rejectUnauthorized: false
				};
				https.get(options, (res: IncomingMessage) => {
					let str: string = '';
					res.on('data', (chunk: string) => {
						str += chunk;
					});
					res.on('end', async () => {
						resolve(str);
					});
				});
			});
		});

		it('--> the original request listener of the server should have handled the request \n', async function (): Promise<void> {
			expect(result).toBe('*** https fallback ***');
		});
	});

});
