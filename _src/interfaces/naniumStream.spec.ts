import { TestDto } from '../tests/services/test/contractparts';
import { NaniumBuffer } from './naniumBuffer';
import { NaniumStream } from './naniumStream';

describe('NaniumStream', function (): void {
	test('isNaniumStream', function (): void {
		expect(NaniumStream.isNaniumStream(NaniumStream)).toBeTruthy();
		expect(NaniumStream.isNaniumStream(new NaniumStream())).toBeTruthy();
		expect(NaniumStream.isNaniumStream(new NaniumBuffer())).toBeFalsy();
	});

	test('Promise: then & finally', async function (): Promise<void> {
		const s = new NaniumStream<TestDto>();
		setTimeout(() => {
			s.write(new TestDto('1', 1));
			s.write(new TestDto('2', 2));
			s.write(new TestDto('3', 3));
			s.end();
		});
		let result: TestDto[] | undefined;
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

	test('toPromise: catch & finally', async function (): Promise<void> {
		const s = new NaniumStream<TestDto>();
		setTimeout(() => {
			s.write(new TestDto('1', 1))
			s.write(new TestDto('2', 2))
			s.error(':-(');
		});
		let result: TestDto[] | null;
		try {
			await s.toPromise();
			expect(1).toBe(2);
		} catch (e) {
			expect(e).toBe(':-(');
		} finally {
			result = null;
		}
		expect(result).toBeNull();
	});

	test('for await: objects', async function (): Promise<void> {
		const s = new NaniumStream<TestDto>();
		let result = [];
		setTimeout(() => {
			s.write(new TestDto('1', 1));
			s.write(new TestDto('2', 2));
			s.write(new TestDto('3', 3));
			s.end();
		}, 10);
		for await (const chunk of s) {
			result.push(chunk);
		}
		result = result.flat(Infinity);
		expect(result.length).toBe(3);
		expect(result[0].a).toBe('1');
		expect(result[0].b).toBe(1);
		expect(result[1].a).toBe('2');
		expect(result[1].b).toBe(2);
		expect(result[2].a).toBe('3');
		expect(result[2].b).toBe(3);
	});

	test('pipeTo: success', async function (): Promise<void> {
		const s1 = new NaniumStream<TestDto>();
		const s2 = new NaniumStream<TestDto>();
		s1.pipeTo(s2);

		setTimeout(() => {
			s1.write(new TestDto('1', 1));
			s1.write(new TestDto('2', 2));
			s1.write(new TestDto('3', 3));
			s1.end();
		});

		let result = [];
		for await (const chunk of s2) {
			result.push(chunk);
		}
		result = result.flat(Infinity);
		expect(result.length).toBe(3);
		expect(result[0].a).toBe('1');
		expect(result[0].b).toBe(1);
		expect(result[1].a).toBe('2');
		expect(result[1].b).toBe(2);
		expect(result[2].a).toBe('3');
		expect(result[2].b).toBe(3);
	});

	test('pipeTo: error', async function (): Promise<void> {
		const s1 = new NaniumStream<TestDto>();
		const s2 = new NaniumStream<TestDto>();
		s1.pipeTo(s2);

		setTimeout(() => {
			s1.write(new TestDto('1', 1));
			s1.error(':-(');
		})

		try {
			for await (const _chunk of s2) {
				;
			}
			expect('expected error not thrown').toBe('');
		} catch (err) {
			expect(err).toBe(':-(');
		}
	});

	test('for await: binary', async function (): Promise<void> {
		const s = new NaniumStream();
		const result: NaniumBuffer = new NaniumBuffer();

		s.write(new NaniumBuffer(new TextEncoder().encode('12')));

		setTimeout(() => {
			s.write(new NaniumBuffer(new TextEncoder().encode('3')));
			s.write(new NaniumBuffer(new TextEncoder().encode('4')));
			s.end();
		})

		for await (const chunk of s) {
			result.write(chunk);
		}
		expect(await result.asString()).toBe('1234');

	});
});
