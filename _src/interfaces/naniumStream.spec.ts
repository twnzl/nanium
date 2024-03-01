import { NaniumStream } from './naniumStream';
import { DataSource, NaniumBuffer } from './naniumBuffer';
import { TestDto } from '../tests/services/test/query.contract';

describe('NaniumStream', function (): void {
	test('Promise: then & finally', async function (): Promise<void> {
		const s = new NaniumStream(TestDto);
		setTimeout(() => {
			s.write([new TestDto('1', 1), new TestDto('2', 2)]);
			s.write(new TestDto('3', 3));
			s.end();
		});
		let result: TestDto[];
		try {
			result = await s.toPromise();
			expect(result.length).toBe(3);
			expect(result[0].a).toBe('1');
			expect(result[0].b).toBe(1);
		} finally {
			result = undefined;
		}
		expect(result).toBeUndefined();
	});

	test('Promise: catch & finally', async function (): Promise<void> {
		const s = new NaniumStream(TestDto);
		setTimeout(() => {
			s.write([new TestDto('1', 1), new TestDto('2', 2)]);
			s.error(':-(');
			s.end();
		});
		let result: TestDto[];
		try {
			result = await s.toPromise();
			expect(1).toBe(2);
		} catch (e) {
			expect(e).toBe(':-(');
		} finally {
			result = undefined;
		}
		expect(result).toBeUndefined();
	});

	test('on data: objects', async function (): Promise<void> {
		const s = new NaniumStream(TestDto);
		let result = [];
		await new Promise<void>((resolve: Function, _reject: Function) => {
			s.onData((chunk: any[]) => {
				result.push(chunk);
			});
			s.onEnd(() => {
				result = result.flat(Infinity);
				expect(result.length).toBe(3);
				expect(result[0].a).toBe('1');
				expect(result[0].b).toBe(1);
				expect(result[1].a).toBe('2');
				expect(result[1].b).toBe(2);
				expect(result[2].a).toBe('3');
				expect(result[2].b).toBe(3);
				resolve();
			});
			s.write([new TestDto('1', 1), new TestDto('2', 2)]);
			s.write(new TestDto('3', 3));
			s.end();
		});
	});

	test('on data: binary', async function (): Promise<void> {
		const s = new NaniumStream(NaniumBuffer);
		const result: NaniumBuffer = new NaniumBuffer();
		await new Promise<void>((resolve: Function, _reject: Function) => {
			s.onData((chunk: DataSource) => {
				result.write(chunk);
			});
			s.onEnd(async () => {
				expect(await result.asString()).toBe('123');
				resolve();
			});
			s.write(new TextEncoder().encode('12'));
			s.write(new TextEncoder().encode('3'));
			s.end();
		});
	});
});
