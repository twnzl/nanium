import {Stats} from 'fs';
import * as findFiles from 'recursive-readdir';
import * as path from 'path';
import ServiceExecutor from './interfaces/serviceExecutor';
import RequestBase from './bases/requestBase';
import ResponseBase from './bases/responseBase';
import {serviceNameSymbol} from './symbols';

let repository: { [serviceName: string]: any };

export default class NocatServer {

	/**
	 * initialize the NocatServer
	 * @param executorsPath base path of the service executor files
	 */
	public static async init(executorsPath?: string): Promise<void> {
		executorsPath = executorsPath || 'executors';
		repository = {};
		const files: string[] = await findFiles(
			executorsPath, [(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.service.js')]);
		for (const file of files) {
			const executor: Function = require(path.resolve(file)).default;
			const serviceName: string = this.getServiceName(executor);
			repository[serviceName] = executor;
		}
	}

	private static getServiceName(executorConstructor: Function): string {
		return executorConstructor.name.replace(/Executor$/g, '');
	}

	static async execute(request: RequestBase): Promise<any> {
		// @ts-ignore
		const serviceName: string = request[serviceNameSymbol];
		if (repository === undefined) {
			throw new Error('nocat server is not initialized');
		}
		if (!repository.hasOwnProperty(serviceName)) {
			throw new Error('unknown service ' + serviceName);
		}
		const executor: ServiceExecutor = new repository[serviceName]();
		return await executor.execute(request);
	}

	// todo queues
	// todo adaptors
	// todo interceptors
	// todo build binary

}
