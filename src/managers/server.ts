import { Stats } from 'fs';
import * as findFiles from 'recursive-readdir';
import * as path from 'path';
import ServiceExecutor from '../interfaces/serviceExecutor';
import ServiceManager from '../interfaces/serviceManager';
import { LogMode, ServerConfig } from '../interfaces/serverConfig';

let repository: { [serviceName: string]: any };

export default class NocatServer implements ServiceManager {
	config: ServerConfig;

	constructor(config: ServerConfig) {
		this.config = {
			executorsPath: config.executorsPath,
			requestInterceptors: config.requestInterceptors || [],
			responseInterceptors: config.responseInterceptors || [],
			logMode: config.logMode || LogMode.info
		};
		repository = {};
	}

	async init(): Promise<void> {
		const files: string[] = await findFiles(this.config.executorsPath,
			[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.js')]);
		for (const file of files) {
			const executor: Function = require(path.resolve(file)).default;
			const serviceName: string = executor.name.replace(/Executor$/g, '');
			repository[serviceName] = executor;
			if (this.config.logMode >= LogMode.info) {
				console.log('service ready: ' + serviceName);
			}
		}
	}

	async execute(serviceName: string, request: any): Promise<any> {
		// validation
		if (repository === undefined) {
			throw new Error('nocat server is not initialized');
		}
		if (!repository.hasOwnProperty(serviceName)) {
			throw new Error('unknown service ' + serviceName);
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
	}

	// todo queues
	// todo build ohne tests
	// todo add property requestSource setzen
	// todo im executor exceptions mit throw
	// todo im executor auch nur body zurück geben muss möglich sein
}
