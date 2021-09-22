import { ServiceRequestQueueEntry } from './serviceRequestQueueEntry';

export interface ServiceRequest<TResponse> {
	execute(): Promise<TResponse>;
	enqueue(options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry>;
}
