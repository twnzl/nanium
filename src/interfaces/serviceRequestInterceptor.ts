import ServiceRequest from './serviceRequest';

export default interface ServiceRequestInterceptor {
	execute(request: ServiceRequest, scope?: string): Promise<ServiceRequest>;
}
