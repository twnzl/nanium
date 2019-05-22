import ServiceConfig from "./serviceConfig";

export interface ServiceExecutor {
	execute(request: any, scope?: string): Promise<any>;
	config?: ServiceConfig;
}
