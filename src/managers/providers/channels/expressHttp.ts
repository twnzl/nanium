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
				await this.execute(req['body'], res);
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
							const json: object = JSON.parse(body);
							await this.execute(json, res);
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

	async execute(json: any, res: ServerResponse): Promise<any> {
		const serviceName: string = Object.keys(json)[0];
		const request: any = new this.serviceRepository[serviceName].Request();
		Object.assign(request, json[serviceName]);
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		if (await Nocat.isStream(request, serviceName)) {
			const result: Observable<any> = Nocat.stream(request, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
			res.statusCode = 200;
			result.subscribe({
				next: (value: any): void => {
					res.write(JSON.stringify(value) + '\n');
					res['flush']();
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
