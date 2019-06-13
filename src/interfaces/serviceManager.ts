export interface ServiceManager {
	execute(serviceName: string, request: any): Promise<any>;

	init(): Promise<void>;
}
