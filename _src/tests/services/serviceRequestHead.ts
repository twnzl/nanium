import { NaniumObject, Type } from '../../objects.js';

export class ServiceRequestHead extends NaniumObject<ServiceRequestHead> {
	@Type(String) token?: string;
	@Type(String) language?: string;
}
