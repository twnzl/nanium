import { NaniumObject, Type } from '../../objects';

export class ServiceRequestHead extends NaniumObject<ServiceRequestHead> {
	@Type(String) token?: string;
	@Type(String) language?: string;
}
