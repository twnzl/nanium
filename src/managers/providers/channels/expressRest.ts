import * as express from 'express';
import { Nocat } from '../../../core';
import { Observable } from 'rxjs';
import { RequestChannelConfig } from '../../../interfaces/requestChannelConfig';
import { RequestChannel } from '../../../interfaces/requestChannel';
import { LogMode } from '../../../interfaces/logMode';
import { ServiceExecutionContext } from '../../../interfaces/serviceExecutionContext';
import { NocatRepository } from '../../../interfaces/serviceRepository';

export class NocatExpressRestChannelConfig implements RequestChannelConfig {
	expressApp: express.Express;
	apiBasePath?: string;
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
	getHttpStatusCode?: (err: any) => number;
}

export class NocatExpressRestChannel implements RequestChannel {
	private config: NocatExpressRestChannelConfig;
	private serviceRepository: NocatRepository;

	constructor(config: NocatExpressRestChannelConfig) {
		this.config = config;
		this.config.getHttpStatusCode = this.config.getHttpStatusCode || ((): number => {
			return 500;
		});
		if (!config.apiBasePath) {
			config.apiBasePath = '/';
		} else {
			if (!config.apiBasePath.endsWith('/')) {
				config.apiBasePath += '/';
			}
			if (!config.apiBasePath.startsWith('/')) {
				config.apiBasePath = '/' + config.apiBasePath;
			}
		}
	}

	async init(serviceRepository: NocatRepository): Promise<void> {
		this.serviceRepository = serviceRepository;
		for (const key in serviceRepository) {
			if (!serviceRepository.hasOwnProperty(key)) {
				continue;
			}
			const request: any = serviceRepository[key].Request;
			if (request.scope === 'public') {
				const { method, path }: { method: string; path: string; } = this.getMethodAndPath(request.serviceName);
				this.config.expressApp[method](path, (req: express.Request, res: express.Response) => {
					const serviceRequest: object = this.createRequest(req);
					if (Nocat.isStream(request.serviceName)) {
						this.stream(request.serviceName, serviceRequest, res);
					} else {
						this.execute(request.serviceName, serviceRequest, res);
					}
				});
			}
		}
	}

	getMethodAndPath(serviceName: string): { method: string, path: string } {
		const parts: string[] = serviceName.match(/[A-Z][a-z]+/g);
		const lastPart: string = parts.pop();
		let path: string = this.config.apiBasePath + parts.join('/').toLowerCase();
		let method: string;
		switch (lastPart) {
			case 'Query':
			case 'Get':
				method = 'get';
				break;
			case 'Update':
			case 'Change':
			case 'Store':
			case 'Put':
				method = 'put';
				break;
			case 'Remove':
			case 'Delete':
				method = 'delete';
				break;
			case 'Create':
			case 'Add':
			case 'Post':
				method = 'post';
				break;
			default:
				method = 'post';
				path = path + '/' + lastPart;
		}
		if (Nocat.logMode === LogMode.info) {
			console.log((method + '    ').substr(0, 7) + ':' + path);
		}
		return { method, path };
		// todo: optional it should be possible to pass a configuration to the constructor where is defined which service shall be exposed with which method/path
	}

	private async execute(serviceName: string, serviceRequest: any, res: express.Response): Promise<any> {
		try {
			const result: any = await Nocat.execute(serviceRequest, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
			if (result !== undefined && result !== null) {
				res.write(JSON.stringify(result)); // todo: user nocat.serialize()
			}
			res.statusCode = 200;
		} catch (e) {
			res.statusCode = this.config.getHttpStatusCode(e);
			res.write(JSON.stringify(e)); // todo: user nocat.serialize()
		}
		res.end();
	}

	private stream(serviceName: string, serviceRequest: object, res: express.Response): void {
		const result: Observable<any> = Nocat.stream(serviceRequest, serviceName, new this.config.executionContextConstructor({ scope: 'public' }));
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
				res.statusCode = this.config.getHttpStatusCode(e);
				res.write(JSON.stringify(e));
			}
		});
	}

	createRequest(req: express.Request): any {
		const request: any = { ...req.body };
		for (const property in req.query) {
			if (!req.query.hasOwnProperty(property)) {
				continue;
			}
			const parts: string[] = property.split('.');
			const value: any = req.query[property];
			let prop: string;
			let subObj: any = request;
			while (parts.length) {
				prop = parts.shift();
				if (!parts.length) {
					subObj[prop] = value;
				} else {
					subObj[prop] = subObj[prop] || {};
				}
				subObj = subObj[prop];
			}
		}
		request['$$headers'] = req.headers || {};
		request['$$rawBody'] = req['$$rawBody'];
		request['$$requestSource'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		return request;
	}
}
