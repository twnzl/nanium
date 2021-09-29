export class NocatRepository {
	[serviceName: string]: {
		Request: new () => any,
		Executor: new () => any
	}
}
