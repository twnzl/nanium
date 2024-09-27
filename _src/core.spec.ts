import { Nanium } from './core';
import { CronConfig, ServiceRequestQueueEntry } from './interfaces/serviceRequestQueueEntry';
import { ServiceRequestQueueEntryState } from './interfaces/serviceRequestQueueEntryState';

describe('Core', () => {
	describe('queue entry: calculate next run', () => {
		const realDate = Date;
		const mockDate: Date = new Date(2024, 9 - 1, 26, 10, 0, 0);
		const lastRun: Date = mockDate;

		beforeAll(() => {
			(global as any).Date.now = jest.fn(() => (mockDate).getTime());
		});

		afterAll(() => {
			(global as any).Date = realDate; // Wiederherstellung des echten Date
		});


		test('interval', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				interval: 10,
			};
			let result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toEqual(new Date(2024, 9 - 1, 26, 10, 0, 10));
			entry.interval = 100;
			result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toEqual(new Date(2024, 9 - 1, 26, 10, 1, 40));
		});

		test('recurring: each year on each Monday in January and April at 10:05:00', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				recurring: {
					month: '1,4',
					dayOfWeek: '1',
					year: '*',
					hour: '10',
					minute: '5',
					second: '0'
				},
			};
			let result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toEqual(new Date(2025, 0, 6, 10, 5, 0));
		});

		test('recurring: each third of month', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				recurring: {
					dayOfMonth: '3',
				},
			};
			let result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toEqual(new Date(2024, 10 - 1, 3, 0, 0, 0));
		});

		test('recurring: on working days always in December', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				recurring: {
					month: '12',
					dayOfWeek: '1-5',
				},
			};
			let result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toEqual(new Date(2024, 12 - 1, 2, 0, 0, 0));
		});

		test('recurring: empty object', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				recurring: {},
			};
			let result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toBeUndefined();
			entry.recurring.hour = '';
			entry.recurring.minute = undefined;
			entry.recurring.second = null;
			result = Nanium.calculateNextRun(entry, lastRun);
			expect(result).toBeUndefined();
		});

		test('recurring: if second is * it should never calculate the same second as lastRun', async () => {
			const entry: TestQueueEntry = {
				serviceName: '...',
				request: {},
				recurring: {
					second: '0,30'
				},
			};
			let result = Nanium.calculateNextRun(entry, lastRun); // via date mock the current time is same as lastRun
			expect(result).toEqual(new Date(2024, 9 - 1, 26, 10, 0, 30));
		});
	});
});

class TestQueueEntry implements ServiceRequestQueueEntry {
	id?: string;
	serviceName: string;
	groupId?: string;
	request: any;
	response?: any;
	state?: ServiceRequestQueueEntryState;
	startDate?: Date;
	endDate?: Date;
	interval?: number;
	recurring?: CronConfig;
	endOfInterval?: Date;
}
