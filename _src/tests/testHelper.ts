import * as http from 'http';
import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import * as https from 'https';
import { Server as HttpsServer } from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { Nanium } from '../core';
import { NaniumProviderNodejs } from '../managers/providers/nodejs';
import { NaniumHttpChannel } from '../managers/providers/channels/http';
import { TestExecutionContext } from './services/testExecutionContext';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { NaniumConsumerNodejsHttp } from '../managers/consumers/nodejsHttp';
import { TestClientRequestInterceptor } from './interceptors/client/test.request.interceptor';
import { LogLevel } from '../interfaces/logger';
import { TestLogger } from './testLogger';
import { TestEventSubscriptionSendInterceptor } from './interceptors/client/test.send-event-subscription.interceptor';

export class TestHelper {
	static httpServer: HttpServer | HttpsServer;
	static port: number;
	static hasServerBeenCalled: boolean;
	static provider: NaniumProviderNodejs;
	static consumer: NaniumConsumerNodejsHttp;

	private static async initHttpServer(protocol: 'http' | 'https'): Promise<void> {
		this.port = protocol === 'http' ? 8888 : 9999;
		if (protocol === 'http') {
			// http server
			this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
				if (!/^\/(api[\/#?]|events?$|events\/delete?$)/gi.test(req.url)) {
					res.write('*** http fallback ***');
					res.statusCode = 200;
					res.end();
				}
			});
		}

		// https server
		else {
			this.httpServer = https.createServer({
					key: fs.readFileSync(path.join(__dirname, 'cert/dummy.key')),
					cert: fs.readFileSync(path.join(__dirname, 'cert/dummy.crt'))
				},
				(req: IncomingMessage, res: ServerResponse) => {
					if (!/^\/(api[\/#?]|events$)/gi.test(req.url)) {
						res.write('*** https fallback ***');
						res.statusCode = 200;
						res.end();
					}
				});
		}

		await new Promise<void>((resolve: Function) => {
			this.httpServer.listen(this.port, () => {
				resolve();
			});
		});
	}

	static async initClientServerScenario(protocol: 'http' | 'https', providerIsSubscriber: boolean = false): Promise<void> {
		await this.initHttpServer(protocol);
		this.hasServerBeenCalled = false;

		// Logging
		Nanium.logger = new TestLogger(LogLevel.info);

		// Nanium provider
		this.provider = new NaniumProviderNodejs({
			servicePath: 'tests/services',
			channels: [
				new NaniumHttpChannel({
					apiPath: '/api',
					eventPath: '/events',
					server: TestHelper.httpServer,
					executionContextConstructor: TestExecutionContext
				})
			],
			requestInterceptors: [TestServerRequestInterceptor],
			// todo: events: eventInterceptors: [TestServerEventInterceptor],
			isResponsible: async (): Promise<number> => {
				if (!this.hasServerBeenCalled) {
					// the first Nanium.Execute will choose the consumer as the responsible manager, the second call from the
					// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
					this.hasServerBeenCalled = true;
					return 0;
				} else {
					this.hasServerBeenCalled = false;
					return 2;
				}
			},
			isResponsibleForEvent: async (): Promise<number> => {
				return providerIsSubscriber ? 1 : 0;
			},
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		});
		await Nanium.addManager(this.provider);

		// Nanium consumer
		this.consumer = new NaniumConsumerNodejsHttp({
			apiUrl: protocol + '://localhost:' + this.port + '/api',
			apiEventUrl: protocol + '://localhost:' + this.port + '/events',
			requestInterceptors: [TestClientRequestInterceptor],
			options: protocol === 'https' ? { rejectUnauthorized: false } : {},
			eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
			isResponsible: async (): Promise<number> => Promise.resolve(1),
			isResponsibleForEvent: async (): Promise<number> => {
				return providerIsSubscriber ? 0 : 1;
			},
			handleError: async (err: any): Promise<any> => {
				throw { handleError: err };
			}
		});
		await Nanium.addManager(this.consumer);
	}

	static async shutdown(): Promise<void> {
		await new Promise<void>((resolve: Function) => {
			if (this.httpServer) {
				this.httpServer.close();
				setTimeout(() => {
					this.httpServer = null;
					resolve();
				}, 100);
			} else {
				resolve();
			}
		});
	}
}
