import { NocatRepository } from '../managers/server';

export interface RequestChannel {
	init(serviceRepository: NocatRepository): Promise<void>;
}
