import { IncomingMessage, ServerResponse } from 'http';
import { Observable } from 'rxjs';

import { Nocat } from '../core';

export class NocatHttpAdaptor {

	static create(config: NocatHttpAdaptorConfig): ((req: IncomingMessage, res: ServerResponse) => void) {
		return (req: IncomingMessage, res: ServerResponse): void => {
			const data: any[] = [];
			req.on('data', (chunk: any) => {
				data.push(chunk);
			}).on('end', async () => {
				const body: string = Buffer.concat(data).toString();
				let done: boolean = false;
				if (config.formats.includes('json') && body.length && body[0] === '{') {
					try {
						const json: object = JSON.parse(body);
						const serviceName: string = Object.keys(json)[0];
						const request: any = json[serviceName];
						if (Nocat.isStream(serviceName)) {
							const result: Observable<any> = Nocat.stream(request, serviceName);
							res.statusCode = 200;
							res.setHeader('Content-Type', 'application/json');
							result.subscribe({
								next: (value: any): void => {
									res.write(JSON.stringify(value) + '\n');
									res['flush']();
								},
								complete: (): void => {
									res.end();
								},
								error: (e: any): void => {
									// config.handleException(e);
									res.statusCode = 500;
									res.write(JSON.stringify(e));
								}
							});
						} else {
							const result: Promise<any> = Nocat.execute(request, serviceName);
							res.write(JSON.stringify(await result));
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

export interface NocatHttpAdaptorConfig {
	formats: string[];
}
