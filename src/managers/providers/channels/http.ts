import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';
import { Observable } from 'rxjs';

import { Nocat } from '../../../core';
import { RequestChannelConfig } from '../../../interfaces/requestChannelConfig';
import { RequestChannel } from '../../../interfaces/requestChannel';
import { NocatRepository } from '../../../interfaces/serviceRepository';
import { NocatJsonSerializer } from '../../../serializers/json';
import { NocatSerializerCore } from '../../../serializers/core';

export interface NocatHttpChannelConfig extends RequestChannelConfig {
	server: HttpServer | HttpsServer;
	apiPath: string;
}

export class NocatHttpChannel implements RequestChannel {
	private serviceRepository: NocatRepository;
	private readonly config: NocatHttpChannelConfig;

	constructor(config: NocatHttpChannelConfig) {
		this.config = {
			...{
				server: undefined,
				apiPath: config.apiPath?.toLowerCase(),
				serializer: new NocatJsonSerializer(),
				executionContextConstructor: Object
			},
			...(config || {})
		};
	}

	async init(serviceRepository: NocatRepository): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.config.server.listeners('request').forEach((listener: (...args: any[]) => void) => {
			this.config.server.removeListener('request', listener);
			this.config.server.on('request', async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
				if (req.method.toLowerCase() === 'post' && req.url.split('?')[0].split('#')[0]?.toLowerCase() === this.config.apiPath) {
					const data: any[] = [];
					req.on('data', (chunk: any) => {
						data.push(chunk);
					}).on('end', async () => {
						const body: string = Buffer.concat(data).toString();
						const deserialized: NocatHttpChannelBody = await this.config.serializer.deserialize(body);
						await this.process(deserialized, res);
					});
				} else {
					listener(req, res);
				}
			});
		});
	}

	async process(deserialized: NocatHttpChannelBody, res: ServerResponse): Promise<any> {
		return await NocatHttpChannel.processCore(this.config, this.serviceRepository, deserialized, res);
	}

	static async processCore(config: RequestChannelConfig, serviceRepository: NocatRepository, deserialized: NocatHttpChannelBody, res: ServerResponse): Promise<any> {
		const serviceName: string = deserialized.serviceName;
		const request: any = NocatSerializerCore.plainToClass(deserialized.request, serviceRepository[serviceName].Request);
		if (deserialized.streamed) {
			if (!request.stream) {
				res.statusCode = 500;
				res.write(await config.serializer.serialize('the service does not support result streaming'));
			}
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Connection', 'keep-alive');
			res.flushHeaders(); // flush the headers to establish SSE with client
			const result: Observable<any> = Nocat.stream(request, serviceName, new config.executionContextConstructor({ scope: 'public' }));
			res.statusCode = 200;
			result.subscribe({
				next: async (value: any): Promise<void> => {
					res.write(await config.serializer.serialize(value) + '\n');
					if (res['flush']) { // if compression is enabled we have to call flush
						res['flush']();
					}
				},
				complete: (): void => {
					res.end();
				},
				error: async (e: any): Promise<void> => {
					res.statusCode = 500;
					res.write(await config.serializer.serialize(e));
				}
			});
		} else {
			try {
				res.setHeader('Content-Type', config.serializer.mimeType);
				const result: any = await Nocat.execute(request, serviceName, new config.executionContextConstructor({ scope: 'public' }));
				if (result !== undefined && result !== null) {
					res.write(await config.serializer.serialize(result));
				}
				res.statusCode = 200;
			} catch (e) {
				res.statusCode = 500;
				res.write(await config.serializer.serialize(e));
			}
			res.end();
		}
	}
}

interface NocatHttpChannelBody {
	serviceName: string;
	request: any;
	streamed?: boolean;
}
