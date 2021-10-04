import { ServiceRequestQueue } from '../interfaces/serviceRequestQueue';
import {
	ServiceRequestQueueEntry,
	ServiceRequestQueueEntryQueryConditions
} from '../interfaces/serviceRequestQueueEntry';
import { Collection, Db, InsertOneResult, ModifyResult, MongoClient, ObjectId } from 'mongodb';
import { ServiceRequestQueueConfig } from '../interfaces/serviceRequestQueueConfig';
import { Nocat } from '../core';
import { KindOfResponsibility } from '../interfaces/kindOfResponsibility';
import { DateHelper } from '../helper';

export class NocatMongoQueue implements ServiceRequestQueue {
	public isShutdownInitiated: boolean;
	public config: MongoQueueServiceRequestQueueConfig;

	private mongoClient: MongoClient;
	private database: Db;
	private collection: Collection<ServiceRequestQueueEntryInternal>;
	private checkTimeoutHandle: any;
	private cleanupTimeoutHandle: any;

	constructor(config: MongoQueueServiceRequestQueueConfig) {
		this.config = {
			...{
				checkInterval: 10, // default: 10 seconds
				cleanupInterval: 3600, // default: one hour
				cleanupAge: 3600 * 24 * 7, // default: one week
				isResponsible: (): KindOfResponsibility => 'yes',
			},
			...(config)
		};
	}

	//#region ServiceRequestQueue
	public async init(): Promise<void> {
		// init db connection
		this.mongoClient = await MongoClient.connect(this.config.serverUrl);
		this.database = this.mongoClient.db(this.config.databaseName);
		this.collection = this.database.collection(this.config.collectionName);
		// init check interval
		const processReadyRequests: () => Promise<void> = async () => {
			if (!this.isShutdownInitiated) {
				const readyEntries: ServiceRequestQueueEntry[] = await this.getEntries({
					states: ['ready']
				});
				for (const entry of readyEntries) {
					Nocat.onReadyQueueEntry(entry, this).then();
				}
				this.checkTimeoutHandle = setTimeout(processReadyRequests, this.config.checkInterval * 1000);
			}
		};
		await processReadyRequests();

		// init cleanup interval
		const cleanUp: Function = async (): Promise<void> => {
			if (!this.isShutdownInitiated) {
				await this.removeEntries({
					states: ['done', 'canceled', 'failed'],
					finishedBefore: DateHelper.addSeconds(-this.config.cleanupAge)
				});
				this.cleanupTimeoutHandle = setTimeout(cleanUp, this.config.cleanupInterval * 1000);
			}
		};
		await cleanUp();
	}

	public isResponsible(entry: ServiceRequestQueueEntry): KindOfResponsibility {
		return this.config.isResponsible(entry);
	}

	public async stop(): Promise<void> {
		this.isShutdownInitiated = true;
		if (this.checkTimeoutHandle) {
			clearTimeout(this.checkTimeoutHandle);
		}
		if (this.cleanupTimeoutHandle) {
			clearTimeout(this.cleanupTimeoutHandle);
		}
		let runningEntries: number;
		while (true) {
			runningEntries = await this.collection.countDocuments({ state: 'running' });
			if (runningEntries === 0) {
				await this.mongoClient.close();
				return;
			} else {
				await this.pause(500);
			}
		}
	}

	public async enqueue(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		const result: InsertOneResult<ServiceRequestQueueEntryInternal> = await this.collection.insertOne(entry);
		entry.id = result.insertedId.toHexString();
		return entry;
	}

	public async tryTake(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		if (this.isShutdownInitiated) {
			return undefined;
		}
		const result: ModifyResult<any> = await this.collection.findOneAndUpdate(
			{ _id: new ObjectId(entry.id), state: 'ready' },
			{ $set: { state: 'running', startDate: new Date() } },
			{ returnDocument: 'after' });
		return NocatMongoQueue.toExternalEntry(result.value);
	}

	public async updateEntry(entry: ServiceRequestQueueEntry): Promise<void> {
		await this.store(entry);
	}

	public async refreshEntry(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		const result: ServiceRequestQueueEntryInternal = await this.collection.findOne(new ObjectId(entry.id));
		return NocatMongoQueue.toExternalEntry(result);
	}

	public async getEntries(conditions?: ServiceRequestQueueEntryQueryConditions): Promise<ServiceRequestQueueEntry[]> {
		const query: any = NocatMongoQueue.buildQuery(conditions);
		const result: ServiceRequestQueueEntryInternal[] = await this.collection.find(query).toArray();
		return result.map((e: ServiceRequestQueueEntryInternal) => NocatMongoQueue.toExternalEntry(e));
	}

	public async removeEntries(conditions?: ServiceRequestQueueEntryQueryConditions): Promise<void> {
		const query: any = NocatMongoQueue.buildQuery(conditions);
		await this.collection.deleteMany(query);
	}

	//#endregion ServiceRequestQueue

	private async store(entry: ServiceRequestQueueEntry): Promise<ServiceRequestQueueEntry> {
		if (!entry) {
			return entry;
		}
		const id: string = entry.id;
		if (id) {
			const data: any = { ...entry };
			data._id = new ObjectId(entry.id);
			delete data.id;
			await this.collection.replaceOne({ _id: new ObjectId(id) }, data, { upsert: true });
		} else {
			const data: InsertOneResult<ServiceRequestQueueEntry> = await this.collection.insertOne(entry);
			entry.id = data.insertedId.toHexString();
		}
		return entry;
	}

	private static buildQuery(conditions: ServiceRequestQueueEntryQueryConditions): any {
		const query: any = {};
		if (conditions) {
			if (conditions.states && conditions.states.length) {
				query.state = { $in: conditions.states };
			}
			if (conditions.finishedBefore) {
				query.endDate = { $lt: conditions.finishedBefore };
			}
		}
		return query;
	}

	private async pause(milliseconds: number): Promise<void> {
		await new Promise<unknown>((resolve: (value: unknown) => void): void => {
			setTimeout(resolve, milliseconds);
		});
	}

	private static toExternalEntry(result: ServiceRequestQueueEntryInternal): ServiceRequestQueueEntry {
		const id: string = result._id.toHexString();
		delete result._id;
		return { ...result, id: id };
	}
}

type ServiceRequestQueueEntryInternal = Omit<ServiceRequestQueueEntry, 'id'> & { _id: ObjectId };

export class MongoQueueServiceRequestQueueConfig extends ServiceRequestQueueConfig {
	/**
	 * Seconds to wait between checks for changes (e.g. new requests) in the queue
	 */
	checkInterval?: number; // todo: the polling should be changed to a mechanism that uses something like database triggers

	/**
	 * in this interval the system checks for old and final request entries that can be removed from the queue
	 */
	cleanupInterval?: number;

	/**
	 * if a request entry is older than this ans has a final state, then it will be removed from the queue
	 */
	cleanupAge?: number;
}
