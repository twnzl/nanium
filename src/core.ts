import { Observable } from 'rxjs';

import { ServiceManager } from './interfaces/serviceManager';
import { ServiceExecutionScope } from './interfaces/serviceRequest';

export class Nocat {
	static manager: ServiceManager;

	static async init(manager: ServiceManager): Promise<void> {
		this.manager = manager;
		await this.manager.init();
	}

	static isStream(serviceName: string): boolean {
		return this.manager.isStream(serviceName);
	}

	static async execute(request: any, serviceName?: string, scope?: ServiceExecutionScope): Promise<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return await this.manager.execute(serviceName, request, scope);
	}

	static stream(request: any, serviceName?: string, scope?: ServiceExecutionScope): Observable<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return this.manager.stream(serviceName, request, scope);
	}
}
