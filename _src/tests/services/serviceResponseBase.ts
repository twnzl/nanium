import { NaniumObject, Type } from '../../objects';

export class ServiceResponseMessage {
	constructor(
		public code?: string,
		public text?: string
	) {
	}
}

export class ServiceError extends NaniumObject<ServiceError> {
	@Type(ServiceResponseMessage) errors?: ServiceResponseMessage[];
	@Type(ServiceResponseMessage) exceptions?: ServiceResponseMessage[];
}
