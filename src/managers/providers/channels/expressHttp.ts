import { IncomingMessage, ServerResponse } from 'http';
import * as express from 'express';
import { RequestChannelConfig } from '../../../interfaces/requestChannelConfig';
import { RequestChannel } from '../../../interfaces/requestChannel';
import { NocatRepository } from '../../../interfaces/serviceRepository';
import { NocatJsonSerializer } from '../../../serializers/json';
import { NocatHttpChannel } from './http';

export interface NocatExpressHttpChannelConfig extends RequestChannelConfig {
	expressApp: express.Express;
	apiPath: string;
}

export class NocatExpressHttpChannel implements RequestChannel {
	private serviceRepository: NocatRepository;
	private readonly config: NocatExpressHttpChannelConfig;

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
				await NocatHttpChannel.processCore(this.config, this.serviceRepository, req['body'], res);
			} else {
				const data: any[] = [];
				req.on('data', (chunk: any) => {
					data.push(chunk);
				}).on('end', async () => {
					const body: string = Buffer.concat(data).toString();
					const deserialized: NocatExpressHttpChannelBody = await this.config.serializer.deserialize(body);
					await NocatHttpChannel.processCore(this.config, this.serviceRepository, deserialized, res);
				});
			}
		});
	}
}

interface NocatExpressHttpChannelBody {
	serviceName: string;
	request: any;
	streamed?: boolean;
}
