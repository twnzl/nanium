import Nocat from '../../core';
import NocatServer from '../../managers/server';
import TestRequest from '../services/contracts/test.request';

describe('execte TestRequest on server \n', function (): void {
	beforeEach(async function (): Promise<void> {
		await Nocat.init(new NocatServer('dist/tests/services/executors'));
	});

	it('--> should execute correct\n', async function (): Promise<void> {
		const result: string = await new TestRequest('hello world').execute();
		expect(result).toBe('hello world :-)');
	});

});

