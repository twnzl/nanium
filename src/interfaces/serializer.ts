import { NocatGenericTypeInfo } from '../serializers/jsonToClass';

export interface NocatSerializer {
	serialize(obj: any): Promise<string>;

	deserialize(str: string): Promise<any>;

	toClass?<T>(plain: any, objectClass: new () => any, genericTypes?: NocatGenericTypeInfo): Promise<T>;

	mimeType: string;
}
