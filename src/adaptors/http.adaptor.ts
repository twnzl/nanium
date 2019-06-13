import { IncomingMessage, ServerResponse } from 'http';
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
						const result: any = await Nocat.execute(json[Object.keys(json)[0]], Object.keys(json)[0]);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.write(JSON.stringify(result));
						res.end();
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
