import ServiceConfig from "./serviceConfig";

export default interface ServiceExecutor {
	execute(request: any, scope?: string): Promise<any>;
	config?: ServiceConfig;
}
