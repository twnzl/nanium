export default interface ServiceResponseInterceptor {
	execute(response: any): Promise<any>;
}
