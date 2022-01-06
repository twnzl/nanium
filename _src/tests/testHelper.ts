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
import { TestEventSubscriptionSendInterceptor } from './events/test.interceptor';

export class TestHelper {
	static httpServer: HttpServer | HttpsServer;
	static port: number;
	static hasServerBeenCalled: boolean;
	static provider: NaniumNodejsProvider;
	static consumer: NaniumConsumerNodejsHttp;

	private static async initHttpServer(protocol: 'http' | 'https'): Promise<void> {
		this.port = protocol === 'http' ? 8888 : 9999;
		if (protocol === 'http') {
			// http server
			this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
				if (!/^\/(api[\/#?]|events$|events\/delete$)/gi.test(req.url)) {
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
					if (!/^\/(api[\/#?]|events$)/gi.test(req.url)) {
						res.write('*** https fallback ***');
						res.statusCode = 200;
						res.end();
					}
				});
			this.httpServer.listen(this.port);
		}
	}

	static async initClientServerScenario(protocol: 'http' | 'https', providerIsSubscriber: boolean = false): Promise<void> {
		await this.initHttpServer(protocol);
		this.hasServerBeenCalled = false;

		// Nanium provider
		this.provider = new NaniumNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'tests/services',
			channels: [
				new NaniumHttpChannel({
					apiPath: '/api',
					eventPath: '/events',
					server: TestHelper.httpServer,
					executionContextConstructor: ServiceRequestContext
				})
			],
			requestInterceptors: [TestServerRequestInterceptor],
			// todo: events: eventInterceptors: [TestServerEventInterceptor],
			isResponsible: async (): Promise<KindOfResponsibility> => {
				if (!this.hasServerBeenCalled) {
					// the first Nanium.Execute will choose the consumer as the responsible manager, the second call from the
					// httpServer will say it is responsible. This is a workaround because server and client run in the same tread
					this.hasServerBeenCalled = true;
					return 'no';
				} else {
					this.hasServerBeenCalled = false;
					return 'yes';
				}
			},
			isResponsibleForEvent: async (): Promise<KindOfResponsibility> => {
				return providerIsSubscriber ? 'yes' : 'no';
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
			isResponsible: async (): Promise<KindOfResponsibility> => Promise.resolve('fallback'),
			isResponsibleForEvent: async (): Promise<KindOfResponsibility> => {
				return providerIsSubscriber ? 'no' : 'yes';
			},
			handleError: async (err: any): Promise<any> => {
				throw err;
			}
		});
		await Nanium.addManager(this.consumer);
	}

	static async shutdown(): Promise<void> {
		this.httpServer?.close();
		await Nanium.shutdown();
	}
}
