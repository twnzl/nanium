import { Observable } from 'rxjs';

import { ServiceManager } from './interfaces/serviceManager';

export class Nocat {
	static manager: ServiceManager;

	static async init(manager: ServiceManager): Promise<void> {
		this.manager = manager;
		await this.manager.init();
	}

	static isStream(serviceName: string): boolean {
		return this.manager.isStream(serviceName);
	}

	static async execute(request: any, serviceName?: string): Promise<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return this.manager.execute(serviceName, request);
	}

	static stream(request: any, serviceName?: string): Observable<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		serviceName = serviceName || request.constructor.serviceName;
		return this.manager.stream(serviceName, request);
	}
}
