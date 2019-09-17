import { IncomingMessage, ServerResponse } from 'http';
import { Observable } from 'rxjs';

import { Nocat } from '../core';
import { RequestChannel, RequestChannelConfig, ServiceExecutionContext, ServiceExecutionScope } from '..';
import * as express from 'express';
import { NocatRepository } from '../managers/server';

export class NocatHttpChannelConfig implements RequestChannelConfig {
	expressApp: express.Express;
	apiPath: string;
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
}

export class NocatHttpChannel implements RequestChannel {

	constructor(private config: NocatHttpChannelConfig) {
	}

	async init(serviceRepository: NocatRepository): Promise<void> {
		this.config.expressApp.post(this.config.apiPath, (req: IncomingMessage, res: ServerResponse): void => {
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
						const serviceName: string = Object.keys(json)[0];
						const request: any = json[serviceName];
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						if (Nocat.isStream(serviceName)) {
							const result: Observable<any> = Nocat.stream(request, serviceName, new this.config.executionContextConstructor({ scope: ServiceExecutionScope.public }));
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
								const result: any = await Nocat.execute(request, serviceName, new this.config.executionContextConstructor({ scope: ServiceExecutionScope.public }));
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
						done = true;
					} catch (e) {
					}
				}
				if (!done) {
					// it is not json, so try the other formats
				}
			});
		});
	}
}
