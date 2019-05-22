import {Stats} from "fs";
import * as findFiles from 'recursive-readdir';
import * as path from "path";
import {ServiceExecutor} from "./interfaces/serviceExecutor";
import {RequestBase} from "./baseClasses/requestBase";

let repository: { [serviceName: string]: any } = undefined;

export default class NocatServer {

	public static async init(servicesPath?: string) {

		// services
		servicesPath = servicesPath || 'services';
		repository = {};
		let files: string[] = await findFiles(
			servicesPath, [(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.service.js')]);
		for (const file of files) {
			const executor = require(path.resolve(file)).default;
			const serviceName: string = this.getServiceName(executor);
			repository[serviceName] = executor;
		}

		//requests
		// contractsPath = contractsPath || 'contracts';
		// repository = {};
		// const files: string[] = await findFiles(
		// 	contractsPath, [(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.request.js')]);
		// for (const file of files) {
		// 	const requestClass = require(path.resolve(file)).default;
		// 	const serviceName: string = new requestClass().getServiceName();
		// 	repository[serviceName] = requestClass;
		// }
		// return new NocatServer();
	}

	private static getServiceName(executorConstructor): string {
		// const ctorString: string = executorConstructor.constructor.toString();
		// let result: string;
		// // es6
		// if (ctorString.startsWith('class')) {
		// 	result = ctorString.split(' ')[1];
		// }
		// // es5
		// else {
		// 	result = ctorString.substring(6, ctorString.indexOf(' '));
		// }

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

	// private static getServiceNameFromFile(file: string, baseDir: string, prefix?: string): string {
	// 	let fullPath: string = baseDir;
	// 	const pathSepRX: RegExp = /[\\/]/g;
	// 	if (prefix) {
	// 		fullPath = path.join(prefix.replace(pathSepRX, '_'), baseDir);
	// 	}
	// 	const result: string = path.relative(fullPath, file).replace(pathSepRX, '_');
	// 	return path.basename(result, '.service.js').split('.')[0];
	// }
}

export class ResponseBase {

}
