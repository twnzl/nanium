export default class Nocat {
	static manager: Manager;

	static init(manager: Manager): void {
		this.manager = manager;
	}

	static async execute(request: any): Promise<any> {
		if (!this.manager) {
			throw new Error('nocat has not been initialized');
		}
		const serviceName: string = request.constructor.name.replace(/Request$/g, '');
		return await this.manager.execute(serviceName, request);
	}
}

export interface Manager {
	execute(serviceName: string, request: any): Promise<any>;
}
