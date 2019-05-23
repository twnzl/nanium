import {Stats} from 'fs';
import * as findFiles from 'recursive-readdir';
import * as path from 'path';
import ServiceExecutor from '../interfaces/serviceExecutor';
import ServiceManager from '../interfaces/serviceManager';

let repository: { [serviceName: string]: any };

export default class NocatServer implements ServiceManager {
	executorsPath: string;

	constructor(executorsPath?: string) {
		this.executorsPath = executorsPath || 'executors';
		repository = {};
	}

	async init(): Promise<void> {
		const files: string[] = await findFiles(this.executorsPath, [(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.js')]);
		for (const file of files) {
			const executor: Function = require(path.resolve(file)).default;
			const serviceName: string = executor.name.replace(/Executor$/g, '');
			repository[serviceName] = executor;
		}
	}

	async execute(serviceName: string, request: any): Promise<any> {
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
