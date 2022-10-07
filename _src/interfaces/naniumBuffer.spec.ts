import { NaniumBuffer } from './naniumBuffer';

describe('NaniumBuffer', function (): void {
	const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
	const buffer: Buffer = Buffer.from('def', 'utf-8');
	const str: string = 'gh😄';
	const uint8Array: Uint8Array = new TextEncoder().encode('jkl');
	const float32Array: Float32Array = new Float32Array(new TextEncoder().encode('mnop').buffer);
	const buffer32 = Buffer.from(new Float32Array(new TextEncoder().encode('qrst')));
	// Blob is tested in browser app.component.spec.ts

	describe('asString', function (): void {
		it('with different types in constructor', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, str, uint8Array, float32Array, buffer32
			]);
			expect(buf.id?.length > 0).toBeTruthy();
			expect(await buf.asString()).toBe('abcdefgh😄jklmnopqrst');
		});

		it('asString with a single arrayBuffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([arrayBuffer]);
			expect(await buf.asString()).toBe('abc');
		});

		it('asString with a single float32Array', async function (): Promise<void> {
			const buf = new NaniumBuffer([float32Array]);
			expect(await buf.asString()).toBe('mnop');
		});

		it('asString write multiple different types', async function (): Promise<void> {
			const buf = new NaniumBuffer(undefined, '1');
			expect(buf.id).toBe('1');
			buf.write(arrayBuffer);
			buf.write(buffer);
			buf.write(str);
			buf.write(uint8Array);
			expect(await buf.asString()).toBe('abcdefgh😄jkl');
		});
	});

	describe('asUInt8Array', function (): void {
		it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, str, uint8Array, float32Array, buffer32
			]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefgh😄jklmnopqrst');
		});

		it('asUInt8Array with a single arrayBuffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([arrayBuffer]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abc');
		});
	});

	it('clear & length=0', async function (): Promise<void> {
		const buf = new NaniumBuffer(undefined, '1');
		expect(buf.id).toBe('1');
		buf.write(arrayBuffer);
		buf.write(buffer);
		expect(buf.length).toBe(6);
		expect(await buf.asString()).toBe('abcdef');
		buf.clear();
		expect(buf.length).toBe(0);
		buf.write(str);
		buf.write(uint8Array);
		expect(buf.length).toBe(9);
		expect(await buf.asString()).toBe('gh😄jkl');
		buf.clear();
		expect(buf.length).toBe(0);
	});
});

