export class NocatRepository {
	[serviceName: string]: {
		Executor: any, // upper case because it are constructors
		Request: any
	}
}
