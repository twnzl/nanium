import { Observable } from 'rxjs';
import { ServiceManager } from './interfaces/serviceManager';
import { ServiceExecutionContext } from './interfaces/serviceExecutionContext';
import { LogMode } from './interfaces/logMode';

export class Nocat {
	static managers: ServiceManager[];
	static logMode: LogMode;

	static async init(managers: ServiceManager[], logMode?: LogMode): Promise<void> {
		this.managers = managers;
		this.logMode = logMode;
		const promises: Promise<any>[] = [];
		for (const manager of this.managers) {
			promises.push(manager.init());
		}
		await Promise.all(promises);
	}

	static isStream(serviceName: string): boolean {
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		return manager.isStream(serviceName);
	}

	static async execute(request: any, serviceName?: string, context?: ServiceExecutionContext): Promise<any> {
		serviceName = serviceName || request.constructor.serviceName;
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		if (!manager) {
			throw new Error('nocat has not been initialized');
		}
		// todo: determine which manager is responsible for this request
		return await manager.execute(serviceName, request, context);
	}

	static stream(request: any, serviceName?: string, context?: ServiceExecutionContext): Observable<any> {
		serviceName = serviceName || request.constructor.serviceName;
		const manager: ServiceManager = this.getResponsibleManager(serviceName);
		if (!manager) {
			throw new Error('nocat has not been initialized');
		}
		return manager.stream(serviceName, request, context);
	}

	static getResponsibleManager(serviceName: string): ServiceManager {
		const result: ServiceManager = this.managers.find((manager: ServiceManager) => manager.isResponsible(serviceName) === 'yes');
		if (result) {
			return result;
		}
		return this.managers.find((manager: ServiceManager) => manager.isResponsible(serviceName) === 'fallback');
	}
}
