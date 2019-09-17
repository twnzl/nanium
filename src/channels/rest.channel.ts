import * as express from 'express';
import { Nocat } from '../core';
import { RequestChannel, RequestChannelConfig, ServiceExecutionContext, ServiceExecutionScope } from '..';
import { NocatRepository } from '../managers/server';

export class NocatRestChannelConfig implements RequestChannelConfig {
	expressApp: express.Express;
	apiBasePath?: string;
	executionContextConstructor: new(data: ServiceExecutionContext) => ServiceExecutionContext;
	getHttpStatusCode?: (err: any) => number;
}

export class NocatRestChannel implements RequestChannel {
	config: NocatRestChannelConfig;

	constructor(config: NocatRestChannelConfig) {
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
		for (const key in serviceRepository) {
			if (!serviceRepository.hasOwnProperty(key)) {
				continue;
			}
			const request: any = serviceRepository[key].Request;
			if (request.scope === ServiceExecutionScope.public) {
				const { method, path }: { method: string; path: string; } = this.getMethodAndPath(request.serviceName);
				this.config.expressApp[method](path, (req: express.Request, res: express.Response) => this.execute(request.serviceName, req, res));
			}
		}
	}

	getMethodAndPath(serviceName: string): { method: string, path: string } {
		const parts: string[] = serviceName.match(/[A-Z][a-z]+/g);
		const lastPart: string = parts.pop();
		let path: string = this.config.apiBasePath + parts.join('/').toLowerCase();
		let method: string = 'post';
		switch (lastPart) {
			case 'Query':
			case 'Get':
				method = 'get';
				break;
			case 'Update':
			case 'Change':
			case 'Put':
				method = 'put';
				break;
			case 'Remove':
			case 'Delete':
				method = 'delete';
				break;
			default:
				method = 'post';
				path = path + '/' + lastPart;
		}
		return { method, path };
		// todo: optional it should be possible to pass a configuration to the constructor where is defined which service shall be exposed with which method/path
	}

	private async execute(serviceName: string, req: express.Request, res: express.Response): Promise<any> {
		const serviceRequest: object = this.createRequest(req);
		serviceRequest['$$headers'] = req.headers || {};
		serviceRequest['$$rawBody'] = req['$$rawBody'];
		serviceRequest['$$requestSource'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		if (Nocat.isStream(serviceName)) {
			// todo: implement
		} else {
			try {
				const result: any = await Nocat.execute(serviceRequest, serviceName, new this.config.executionContextConstructor({ scope: ServiceExecutionScope.public }));
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
		return request;
	}
}
