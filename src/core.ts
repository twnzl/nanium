import ServiceManager from './interfaces/serviceManager';

export default class Nocat {
	static manager: ServiceManager;

	static async init(manager: ServiceManager): Promise<void> {
		this.manager = manager;
		await this.manager.init();
	}

	static async execute(request: any): Promise<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		const serviceName: string = request.constructor.name.replace(/Request$/g, '');
		return await this.manager.execute(serviceName, request);
	}
}
