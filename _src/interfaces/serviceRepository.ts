export class NaniumRepository {
	[serviceName: string]: {
		Request: new () => any,
		Executor: new () => any
	}
}
