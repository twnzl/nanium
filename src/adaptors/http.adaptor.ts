import { IncomingMessage, ServerResponse } from 'http';
import { Observable } from 'rxjs';

import { Nocat } from '../core';
import { ServiceExecutionScope, TransportAdaptorConfig } from '..';

export class NocatHttpAdaptor {

	static create(config: TransportAdaptorConfig): ((req: IncomingMessage, res: ServerResponse) => void) {
		return (req: IncomingMessage, res: ServerResponse): void => {
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
							const result: Observable<any> = Nocat.stream(request, serviceName, new config.executionContextConstructor({ scope: ServiceExecutionScope.public }));
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
								const result: any = await Nocat.execute(request, serviceName, new config.executionContextConstructor({ scope: ServiceExecutionScope.public }));
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
		};
	}
}
