import { NocatRepository } from './serviceRepository';

export interface RequestChannel {
	init(serviceRepository: NocatRepository): Promise<void>;
}
