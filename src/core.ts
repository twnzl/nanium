import { Observable } from 'rxjs';

import { ServiceManager } from './interfaces/serviceManager';
import { ServiceExecutionContext } from './interfaces/serviceExecutionContext';
import { LogMode } from './interfaces/serverConfig';

export class Nocat {
	static manager: ServiceManager;
	static logMode: LogMode;

	static async init(manager: ServiceManager, logMode?: LogMode): Promise<void> {
		this.manager = manager;
		this.logMode = logMode;
		await this.manager.init();
	}

	static isStream(serviceName: string): boolean {
		return this.manager.isStream(serviceName);
	}

	static async execute(request: any, serviceName?: string, context?: ServiceExecutionContext): Promise<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return await this.manager.execute(serviceName, request, context);
	}

	static stream(request: any, serviceName?: string, context?: ServiceExecutionContext): Observable<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return this.manager.stream(serviceName, request, context);
	}
}
