import * as http from 'http';
import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import * as https from 'https';
import { Server as HttpsServer } from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { Nanium } from '../core';
import { NaniumNodejsProvider } from '../managers/providers/nodejs';
import { LogMode } from '../interfaces/logMode';
import { NaniumHttpChannel } from '../managers/providers/channels/http';
import { ServiceRequestContext } from './services/serviceRequestContext';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';
import { NaniumConsumerNodejsHttp } from '../managers/consumers/nodejsHttp';
import { TestClientRequestInterceptor } from './interceptors/client/test.request.interceptor';

export class TestHelper {
	static httpServer: HttpServer | HttpsServer;
	static port: number;
	static hasServerBeenCalled: boolean;

	private static async initHttpServer(protocol: 'http' | 'https'): Promise<void> {
		this.port = protocol === 'http' ? 8888 : 9999;
		if (protocol === 'http') {
			// http server
			this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
				if (!/^\/api[\/#?]/gi.test(req.url)) {
					res.write('*** http fallback ***');
					res.statusCode = 200;
					res.end();
				}
			});
			this.httpServer.listen(this.port);
		}

		// https server
		else {
			this.httpServer = https.createServer({
					key: fs.readFileSync(path.join(__dirname, 'cert/dummy.key')),
					cert: fs.readFileSync(path.join(__dirname, 'cert/dummy.crt'))
				},
				(req: IncomingMessage, res: ServerResponse) => {
					res.write('*** https fallback ***');
					res.statusCode = 200;
					res.end();
				});
			this.httpServer.listen(this.port);
		}
	}

	static async initClientServerScenario(protocol: 'http' | 'https'): Promise<void> {
		await this.initHttpServer(protocol);

		// Nanium provider and consumer
		this.hasServerBeenCalled = false;
		await Nanium.addManager(new NaniumNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services',
			requestChannels: [
				new NaniumHttpChannel({
					apiPath: '/api',
					server: TestHelper.httpServer,
					executionContextConstructor: ServiceRequestContext
				})
			],
			requestInterceptors: [TestServerRequestInterceptor],
			isResponsible: async (): Promise<KindOfResponsibility> => {
				if (!this.hasServerBeenCalled) {
					// the first Nanium.Execute will chose the consumer as the responsible manager, the second call from the
					// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
					this.hasServerBeenCalled = true;
					return 'no';
				} else {
					this.hasServerBeenCalled = false;
					return 'yes';
				}
			},
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));

		await Nanium.addManager(new NaniumConsumerNodejsHttp({
			apiUrl: 'http://localhost:' + this.port + '/api',
			requestInterceptors: [TestClientRequestInterceptor],
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('fallback'),
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		}));
	}

	static async shutdown(): Promise<void> {
		this.httpServer.close();
		await Nanium.shutdown();
	}
}
