import { Nocat } from '../core';
import { NocatNodejsProvider } from '../managers/providers/nodejs';
import { TestServerRequestInterceptor } from './interceptors/server/test.request.interceptor';
import { TestGetRequest } from './services/test/get.contract';
import { ServiceResponseBase, ServiceResponseMessage } from './services/serviceResponseBase';
import { LogMode } from '../interfaces/logMode';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';
import { NocatMongoQueue } from '../queues/mongo.queue';
import { ServiceRequestQueueEntry } from '../interfaces/serviceRequestQueueEntry';
import { Collection, Db, MongoClient } from 'mongodb';
import { TestExecutionContext } from './services/serviceExecutionContext';
import { AsyncHelper, DateHelper } from '../helper';
import { DateMock } from './mocks/date.mock';

let mongoQueue: NocatMongoQueue;

describe('MongoQueue Tests \n', function (): void {

	beforeEach(async function (): Promise<void> {
		await Nocat.addManager(new NocatNodejsProvider({
			logMode: LogMode.error,
			servicePath: 'dist/tests/services',
			requestInterceptors: { test: TestServerRequestInterceptor },
			isResponsible: (): KindOfResponsibility => 'yes',
			handleError: async (err: any): Promise<any> => {
				if (err instanceof ServiceResponseMessage) {
					return new ServiceResponseBase({}, { errors: [err] });
				}
				if (err instanceof Error && err.message === 'no!') {
					return new ServiceResponseBase({}, { exceptions: [{ code: 'ErrorLogId0815' }] });
				}
				throw err;
			}
		}));
		mongoQueue = new NocatMongoQueue({
			checkInterval: 1,
			serverUrl: /*await mongoUnit.start({ port: 27020 }),*/ 'mongodb://localhost:27017',
			databaseName: 'nocat_test',
			collectionName: 'rq',
			getExecutionContext: () => new TestExecutionContext(),
			isResponsible: (): KindOfResponsibility => 'yes',
		});
		await Nocat.addQueue(mongoQueue);
		await mongoQueue.removeEntries();
	});

	afterEach(async (): Promise<void> => {
		await Nocat.shutdown();
		expect(mongoQueue.isShutdownInitiated, 'Nocat.shutdown should stop all queues').toBe(true);
		mongoQueue = undefined;
	});

	it('immediate and successful --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 2 }).enqueue();
		await AsyncHelper.pause(500);
		const entries: ServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length).toBe(1);
		expect(entries[0].state).toBe('done');
		expect(entries[0].response.body.output1).toBe('1 :-)');
	});

	it('immediate but with Exception --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 10 }).enqueue();
		await AsyncHelper.pause(500);
		const entries: ServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length, 'there should be one entry in the queue').toBe(1);
		expect(entries[0].state).toBe('failed');
		expect(entries[0].response.startsWith('Error: no no!')).toBe(true);
	});

	it('immediate and with interval --> \n', async function (): Promise<void> {
		await new TestGetRequest({ input1: '1', input2: 2 }).enqueue({ interval: 300 });
		DateMock.start();
		const nextRunDate: Date = DateHelper.addSeconds(300, DateMock.value);
		await AsyncHelper.pause(500);
		const entries: ServiceRequestQueueEntry[] = await mongoQueue.getEntries();
		expect(entries.length, 'there should be two entries in the queue - the finished one and the one for the next execution after the interval').toBe(2);
		expect(entries[0].state).toBe('done');
		expect(entries[1].state, 'a second entry must be inserted with state ready').toBe('ready');
		expect(entries[1].startDate.toISOString(), 'a second entry must be inserted with startDate set according to the interval').toBe(nextRunDate.toISOString());
		DateMock.end();
	});

	it('inserted via db --> \n', async function (): Promise<void> {
		const mongoClient: MongoClient = await MongoClient.connect(mongoQueue.config.serverUrl, {});
		const database: Db = await mongoClient.db(mongoQueue.config.databaseName);
		const collection: Collection<ServiceRequestQueueEntry> = await database.collection(mongoQueue.config.collectionName);
		await collection.insertOne(<ServiceRequestQueueEntry>{
			state: 'ready',
			serviceName: TestGetRequest.serviceName,
			request: new TestGetRequest({ input1: '1', input2: 3 })
		});
		await AsyncHelper.pause(2000);
		const entries: ServiceRequestQueueEntry[] = await collection.find().toArray();
		expect(entries.length, 'there should be one entry in the queue').toBe(1);
		expect(entries[0].state, 'state should be done').toBe('done');
		expect(entries[0].response.body.output1).toBe('1 :-)');
		await mongoClient.close();
	});
});
