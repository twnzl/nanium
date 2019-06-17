import { Stats } from 'fs';
import * as findFiles from 'recursive-readdir';
import * as path from 'path';
import { ServiceExecutor } from '../interfaces/serviceExecutor';
import { ServiceManager } from '../interfaces/serviceManager';
import { LogMode, ServerConfig } from '../interfaces/serverConfig';
import { ServiceResponseBase, ServiceResponseMessage } from '../tests/services/serviceResponseBase';

let repository: { [serviceName: string]: any };

export class NocatServer implements ServiceManager {
	config: ServerConfig = {
		servicePath: 'services',
		requestInterceptors: [],
		responseInterceptors: [],
		logMode: LogMode.error,
		handleError: (err: any): any => {
			if (err instanceof ServiceResponseMessage) {
				return new ServiceResponseBase({}, { errors: [err] });
			}
			throw err;
		}
	};

	constructor(config: ServerConfig) {
		this.config = {
			...this.config,
			...config
		};
		repository = {};
	}

	async init(): Promise<void> {
		const files: string[] = await findFiles(this.config.servicePath,
			[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.js')]);
		for (const file of files) {
			const executor: { serviceName: string } = require(path.resolve(file)).default;
			repository[executor.serviceName] = executor;
			if (this.config.logMode >= LogMode.info) {
				console.log('service ready: ' + executor.serviceName);
			}
		}
	}

	async execute(serviceName: string, request: any): Promise<any> {
		try {
			// validation
			if (repository === undefined) {
				return this.config.handleError(new Error('nocat server is not initialized'));
			}
			if (!repository.hasOwnProperty(serviceName)) {
				return this.config.handleError(new Error('unknown service ' + serviceName));
			}

			// execute request interceptors
			if (this.config.requestInterceptors.length) {
				for (const interceptor of this.config.requestInterceptors) {
					request = await interceptor.execute(request);
				}
			}

			// execute the request
			const executor: ServiceExecutor<any, any> = new repository[serviceName]();
			let response: any = await executor.execute(request);

			// execute response interceptors
			if (this.config.responseInterceptors.length) {
				for (const interceptor of this.config.responseInterceptors) {
					response = await interceptor.execute(response);
				}
			}

			return response;
		} catch (e) {
			return this.config.handleError(e);
		}
	}

	// todo queues
	// todo build ohne tests
	// todo add property requestSource setzen
	// todo im executor exceptions mit throw
	// todo im executor auch nur body zurück geben muss möglich sein
}
