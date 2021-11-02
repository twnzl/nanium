import { IncomingMessage, ServerResponse } from 'http';
import { Observable } from 'rxjs';

import { Nocat } from '../../../core';
import * as express from 'express';
import { RequestChannelConfig } from '../../../interfaces/requestChannelConfig';
import { RequestChannel } from '../../../interfaces/requestChannel';
import { NocatRepository } from '../../../interfaces/serviceRepository';
import { NocatJsonSerializer } from '../../../serializers/json';

export interface NocatExpressHttpChannelConfig extends RequestChannelConfig {
	expressApp: express.Express;
	apiPath: string;
}

export class NocatExpressHttpChannel implements RequestChannel {
	private serviceRepository: NocatRepository;
	private config: NocatExpressHttpChannelConfig;

	constructor(config: NocatExpressHttpChannelConfig) {
		this.config = {
			...{
				expressApp: undefined,
				apiPath: undefined,
				serializer: new NocatJsonSerializer(),
				executionContextConstructor: Object
			},
			...(config || {})
		};
	}

	async init(serviceRepository: NocatRepository): Promise<void> {
		this.serviceRepository = serviceRepository;
		this.config.expressApp.post(this.config.apiPath, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
			if (req['body']) {
				await this.process(req['body'], res);
			} else {
				const data: any[] = [];
				req.on('data', (chunk: any) => {
					data.push(chunk);
				}).on('end', async () => {
					const body: string = Buffer.concat(data).toString();
					let done: boolean = false;
					if (body.length && body[0] === '{') {
						try {
							const json: NocatExpressHttpChannelBody = await this.config.serializer.deserialize(body);
							await this.process(json, res);
							done = true;
						} catch (e) {
						}
					}
					if (!done) {
						// it is not json, so try the other formats
					}
				});
			}
		});
	}

	async process(json: NocatExpressHttpChannelBody, res: ServerResponse): Promise<any> {
		const serviceName: string = json.serviceName;
		const request: any = new this.serviceRepository[serviceName].Request();
		Object.assign(request, json.request);
		if (json.streamed) {
			if (!request.stream) {
				res.statusCode = 500;
				res.write(await this.config.serializer.serialize('the service does not support result streaming'));
			}
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Connection', 'keep-alive');
			res.flushHeaders(); // flush the headers to establish SSE with client
			const result: Observable<any> = Nocat.stream(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
			res.statusCode = 200;
			result.subscribe({
				next: async (value: any): Promise<void> => {
					res.write(await this.config.serializer.serialize(value) + '\n');
					if (res['flush']) { // if compression is enabled we have to call flush
						res['flush']();
					}
				},
				complete: (): void => {
					res.end();
				},
				error: async (e: any): Promise<void> => {
					res.statusCode = 500;
					res.write(await this.config.serializer.serialize(e));
				}
			});
		} else {
			try {
				res.setHeader('Content-Type', 'application/json; charset=utf-8');
				const result: any = await Nocat.execute(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
				if (result !== undefined && result !== null) {
					res.write(await this.config.serializer.serialize(result));
				}
				res.statusCode = 200;
			} catch (e) {
				res.statusCode = 500;
				res.write(await this.config.serializer.serialize(e));
			}
			res.end();
		}
	}
}

interface NocatExpressHttpChannelBody {
	serviceName: string;
	request: any;
	streamed?: boolean;
}
