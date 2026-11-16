import * as fs from 'fs';
import * as http from 'http';
import { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import * as https from 'https';
import { Server as HttpsServer } from 'https';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Nanium } from '../core.js';
import { RejectFunction, ResolveFunction } from '../helper.js';
import { LogLevel, NaniumLogger } from '../interfaces/logger.js';
import { NaniumConsumerNodejsHttp } from '../managers/consumers/nodejsHttp.js';
import { NaniumHttpChannel } from '../managers/providers/channels/http.js';
import { NaniumProviderNodejs } from '../managers/providers/nodejs.js';
import { NaniumJsonSerializer } from '../serializers/json.js';
import { TestClientRequestInterceptor } from './interceptors/client/test.request.interceptor.js';
import { TestEventSubscriptionSendInterceptor } from './interceptors/client/test.send-event-subscription.interceptor.js';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor.js';
import { TestExecutionContext } from './services/testExecutionContext.js';
import { TestLogger } from './testLogger.js';

const __dirname: string = path.dirname(fileURLToPath(import.meta.url));

export class TestHelper {
	static httpServer: HttpServer | HttpsServer;
	static port: number;
	static provider: NaniumProviderNodejs;
	static consumer: NaniumConsumerNodejsHttp;

	private static responsibility: 'consumer' | 'provider' = 'consumer';

	private static async initHttpServer(protocol: 'http' | 'https'): Promise<void> {
		if (this.httpServer) {
			await this.shutdown();
		}
		this.port = protocol === 'http' ? 8888 : 9999;
		if (protocol === 'http') {
			// http server
			this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
				if (!/^\/(api[/#?]|events?$|events\/delete?$)/gi.test(req.url)) {
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
				cert: fs.readFileSync(path.join(__dirname, 'cert/dummy.crt')),
				keepAlive: false,

			},
				(req: IncomingMessage, res: ServerResponse) => {
					if (!/^\/(api[/#?]|events$)/gi.test(req.url)) {
						res.write('*** https fallback ***');
						res.statusCode = 200;
						res.end();
					}
				});
		}

		await new Promise<void>((resolve: ResolveFunction<void>) => {
			this.httpServer.listen(this.port, () => {
				resolve();
			});
		});
	}

	static async initClientServerScenario(protocol: 'http' | 'https', providerIsSubscriber: boolean = false): Promise<void> {
		await this.initHttpServer(protocol);
		this.responsibility = 'consumer';

		// Logging
		NaniumLogger.addLogger(new TestLogger(LogLevel.info));

		// Nanium provider
		this.provider = new NaniumProviderNodejs({
			servicePath: 'dist/tests/services',
			channels: [
				new NaniumHttpChannel('hc1', {
					apiPath: '/api',
					eventPath: '/events',
					server: TestHelper.httpServer,
					executionContextConstructor: TestExecutionContext,
					serializer: new NaniumJsonSerializer()
				})
			],
			requestInterceptors: [TestServerRequestInterceptor],
			// todo: events: eventInterceptors: [TestServerEventInterceptor],
			isResponsible: async (): Promise<number> => {
				// the first Nanium.Execute will choose the consumer as the responsible manager, the second call from the
				// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
				if (this.responsibility === 'consumer') {
					this.responsibility = 'provider';
					return Promise.resolve(0);
				} else {
					this.responsibility = 'consumer';
					return Promise.resolve(2);
				}
			},
			isResponsibleForEvent: async (): Promise<number> => {
				return Promise.resolve(providerIsSubscriber ? 1 : 0);
			},
			handleError: (err: any): Promise<any> => {
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
			isResponsibleForEvent: (): Promise<number> => {
				return Promise.resolve(providerIsSubscriber ? 0 : 1);
			},
			handleError: (err: any): Promise<any> => {
				throw { handleError: err };
			}
		});
		await Nanium.addManager(this.consumer);
	}

	static async shutdown(): Promise<void> {
		await new Promise<void>((resolve: ResolveFunction<void>, reject: RejectFunction) => {
			try {
				if (this.httpServer) {

					if (typeof this.httpServer.closeAllConnections === 'function') {
						this.httpServer.closeAllConnections();
					}
					this.httpServer.unref();

					this.httpServer.close(async (err) => {
						if (err) {
							reject(err);
						}
						try {
							await Nanium.shutdown();
							this.httpServer = null;
						} catch (e) {
							console.error(e);
						} finally {
							setTimeout(() => resolve(), 100); // to give the https core time to really close all connections and TLS-wrappers (prevent jests open-handles warning)
						}
					});
				} else {
					resolve();
				}
			} catch (e) {
				console.error(e);
				throw e;
			}
		});
	}
}
