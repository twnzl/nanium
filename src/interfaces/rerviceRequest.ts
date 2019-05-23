export default interface ServiceRequest {
	execute(scope?: string): Promise<any>;
}
