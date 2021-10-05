import { IncomingMessage, ServerResponse } from 'http';
import { Observable } from 'rxjs';

import { Nocat } from '../../../core';
import * as express from 'express';
import { RequestChannelConfig } from '../../../interfaces/requestChannelConfig';
import { ServiceExecutionContext } from '../../../interfaces/serviceExecutionContext';
import { RequestChannel } from '../../../interfaces/requestChannel';
import { NocatRepository } from '../../../interfaces/serviceRepository';

export class NocatExpressHttpChannelConfig implements RequestChannelConfig {
	expressApp: express.Express;
	apiPath: string;
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
}

export class NocatExpressHttpChannel implements RequestChannel {
	private serviceRepository: NocatRepository;

	constructor(private config: NocatExpressHttpChannelConfig) {
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
					// todo: for now only json is supported. later here the nocat.deserialize() function should be used which uses the registered Format-Adaptors to deserialize and serialize
					if (body.length && body[0] === '{') {
						try {
							const json: NocatExpressHttpChannelBody = JSON.parse(body);
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
				res.write(JSON.stringify('the service does not support result streaming'));
			}
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Connection', 'keep-alive');
			res.flushHeaders(); // flush the headers to establish SSE with client
			const result: Observable<any> = Nocat.stream(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
			res.statusCode = 200;
			result.subscribe({
				next: (value: any): void => {
					res.write(JSON.stringify(value) + '\n');
					if (res['flush']) { // if compression is enabled we have to call flush
						res['flush']();
					}
				},
				complete: (): void => {
					res.end();
				},
				error: (e: any): void => {
					res.statusCode = 500;
					res.write(JSON.stringify(e));
				}
			});
		} else {
			try {
				res.setHeader('Content-Type', 'application/json; charset=utf-8');
				const result: any = await Nocat.execute(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
				if (result !== undefined && result !== null) {
					res.write(JSON.stringify(result)); // todo: user nocat.serialize()
				}
				res.statusCode = 200;
			} catch (e) {
				res.statusCode = 500;
				res.write(JSON.stringify(e)); // todo: user nocat.serialize()
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
