import { NaniumBuffer } from './naniumBuffer';

describe('NaniumBuffer', function (): void {
	const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
	const buffer: Buffer = Buffer.from('def', 'utf-8');
	const uint8Array: Uint8Array = new TextEncoder().encode('jkl');
	const float32Array: Float32Array = new Float32Array(new TextEncoder().encode('mnop').buffer);
	const buffer32 = Buffer.from(new Float32Array(new TextEncoder().encode('qrst')));
	// Blob is tested in browser app.component.spec.ts

	describe('asString', function (): void {
		it('with different types in constructor', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32
			]);
			expect(buf.id?.length > 0).toBeTruthy();
			expect(await buf.asString()).toBe('abcdefjklmnopqrst');
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
			buf.write(uint8Array);
			expect(await buf.asString()).toBe('abcdefjkl');
		});
	});

	describe('asUInt8Array', function (): void {
		it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32
			]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrst');
		});

		it('asUInt8Array with a single arrayBuffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([arrayBuffer]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abc');
		});

		it('asUInt8Array with a single Buffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([buffer]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('def');
		});

		it('asUInt8Array with different types in constructor and additional NaniumBuffer written\n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32,
			]);
			buf.write(new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32,
			]));
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrstabcdefjklmnopqrst');
		});

		it('asUInt8Array with different types in constructor and same NaniumBuffer written again to itself\n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32,
			]);
			buf.write(buf);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrstabcdefjklmnopqrst');
		});
	});

	describe('as())', function (): void {
		it('as(Buffer) with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32
			]);
			const b = await buf.as(Buffer);
			expect(b instanceof Buffer).toBeTruthy();
			expect(new TextDecoder().decode(new Uint8Array(b, b.byteOffset, b.byteLength))).toBe('abcdefjklmnopqrst');
		});

		it('as(ArrayBuffer) with Buffer with smaller byteLength than the underlying ArrayBuffer \n', async function (): Promise<void> {
			const b: Buffer = Buffer.from(new TextEncoder().encode('abcdefghijklmn').buffer, 5, 3);
			const ab = await NaniumBuffer.as(ArrayBuffer, b);
			expect(ab instanceof ArrayBuffer).toBeTruthy();
			expect(new TextDecoder().decode(new Uint8Array(ab))).toBe('fgh');
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
		buf.write(float32Array);
		buf.write(uint8Array);
		buf.write(buffer32);
		expect(buf.length).toBe(11);
		expect(await buf.asString()).toBe('mnopjklqrst');
		buf.clear();
		expect(buf.length).toBe(0);
	});

	it('--> slice \n', async function (): Promise<void> {
		const buf = new NaniumBuffer([
			arrayBuffer, buffer, uint8Array, float32Array, buffer32
		]);
		expect(await buf.asString()).toBe('abcdefjklmnopqrst');
		expect(await buf.slice(0).asString()).toBe('abcdefjklmnopqrst');
		expect(await buf.slice(0, 3).asString()).toBe('abc');
		expect(await buf.slice(0, 4).asString()).toBe('abcd');
		expect(await buf.slice(0, -1).asString()).toBe('abcdefjklmnopqrs');
		expect(await buf.slice(1, -1).asString()).toBe('bcdefjklmnopqrs');
		expect(await buf.slice(3, -1).asString()).toBe('defjklmnopqrs');
		expect(await buf.slice(4, -1).asString()).toBe('efjklmnopqrs');
		expect(await buf.slice(6, -1).asString()).toBe('jklmnopqrs');
		expect(await buf.slice(7, -1).asString()).toBe('klmnopqrs');
		expect(await buf.slice(9, -1).asString()).toBe('mnopqrs');
		expect(await buf.slice(10, -1).asString()).toBe('nopqrs');
		expect(await buf.slice(13, -1).asString()).toBe('qrs');
		expect(await buf.slice(14, -1).asString()).toBe('rs');

		expect(await buf.slice(1, -4).asString()).toBe('bcdefjklmnop');
		expect(await buf.slice(1, -5).asString()).toBe('bcdefjklmno');
		expect(await buf.slice(1, -8).asString()).toBe('bcdefjkl');
		expect(await buf.slice(1, -9).asString()).toBe('bcdefjk');
		expect(await buf.slice(1, -11).asString()).toBe('bcdef');
		expect(await buf.slice(1, -12).asString()).toBe('bcde');
		expect(await buf.slice(1, -14).asString()).toBe('bc');
		expect(await buf.slice(1, -15).asString()).toBe('b');
		expect(await buf.slice(0, -15).asString()).toBe('ab');
	});

	it('--> readFloat32LE \n', async function (): Promise<void> {
		let buf = new NaniumBuffer([uint8Array, new Int8Array([-12]), buffer32]);
		expect((await buf.readInt8LE(3))).toBe(-12);
		buf = new NaniumBuffer([uint8Array, new Int16Array([-12]), buffer32]);
		expect((await buf.readInt16LE(3))).toBe(-12);
		buf = new NaniumBuffer([uint8Array, new Int32Array([-12]), buffer32]);
		expect((await buf.readInt32LE(3))).toBe(-12);

		buf = new NaniumBuffer([uint8Array, new Uint8Array([12]), buffer32]);
		expect((await buf.readUInt8LE(3))).toBe(12);
		buf = new NaniumBuffer([uint8Array, new Uint16Array([12]), buffer32]);
		expect((await buf.readUInt16LE(3))).toBe(12);
		buf = new NaniumBuffer([uint8Array, new Uint32Array([12]), buffer32]);
		expect((await buf.readUInt32LE(3))).toBe(12);

		buf = new NaniumBuffer([uint8Array, new Float32Array([12.345]), buffer32]);
		expect((await buf.readFloat32LE(3)).toFixed(6)).toBe('12.345000');
		buf = new NaniumBuffer([uint8Array, new Float64Array([12.3456789012345]), buffer32]);
		expect((await buf.readFloat64LE(3)).toFixed(13)).toBe('12.3456789012345');
	});
});

