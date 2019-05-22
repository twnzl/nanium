import {Stats} from "fs";
import * as findFiles from 'recursive-readdir';
import * as path from "path";
import {ServiceExecutor} from "./interfaces/serviceExecutor";
import {RequestBase} from "./baseClasses/requestBase";

let repository: { [serviceName: string]: any } = undefined;

export default class NocatServer {

	/**
	 * initialize the NocatServer
	 * @param executorsPath base path of the service executor files
	 */
	public static async init(executorsPath?: string) {
		executorsPath = executorsPath || 'executors';
		repository = {};
		let files: string[] = await findFiles(
			executorsPath, [(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.service.js')]);
		for (const file of files) {
			const executor = require(path.resolve(file)).default;
			const serviceName: string = this.getServiceName(executor);
			repository[serviceName] = executor;
		}
	}

	private static getServiceName(executorConstructor): string {
		return executorConstructor.name.replace(/Executor$/g, '');
	}

	static async execute(serviceName: string, request: RequestBase): Promise<ResponseBase> {
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

export class ResponseBase {

}