import { NaniumRepository } from './serviceRepository';

export interface RequestChannel {
	init(serviceRepository: NaniumRepository): Promise<void>;
}
