import { Blob } from 'node:buffer';
import { NaniumBuffer, NaniumBufferReadable } from './naniumBuffer';
import { NaniumStream } from './naniumStream';

describe('NaniumBuffer', function (): void {
	const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
	const buffer: Buffer = Buffer.from('def', 'utf-8');
	const uint8Array: Uint8Array = new TextEncoder().encode('jkl');
	const float32Array: Float32Array = new Float32Array(new TextEncoder().encode('mnop').buffer);
	const buffer32 = Buffer.from(new TextEncoder().encode('qrst'));
	const dataView = new DataView(new TextEncoder().encode('uvw').buffer);
	const blob = new Blob([new TextEncoder().encode('xyz')]);

	test('isNaniumBuffer', async function (): Promise<void> {
		expect(NaniumBuffer.isNaniumBuffer(NaniumBuffer)).toBeTruthy();
		expect(NaniumBuffer.isNaniumBuffer(new NaniumBuffer())).toBeTruthy();
		expect(NaniumBuffer.isNaniumBuffer(new NaniumStream())).toBeFalsy();
	});

	describe('asString', function (): void {
		it('with different types in constructor', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			expect(buf.id?.length > 0).toBeTruthy();
			expect(await buf.asString()).toBe('abcdefjklmnopqrstuvwxyz');
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

		it('asString with bigger internal buffer than data\n', async () => {
			const largeBuffer = new ArrayBuffer(100); // 100 bytes buffer
			const smallView = new Uint8Array(largeBuffer, 10, 3); // only 3 bytes starting at offset 10
			smallView[0] = 65; // 'A'
			smallView[1] = 66; // 'B'
			smallView[2] = 67; // 'C'
			const buf = new NaniumBuffer([arrayBuffer, smallView]);
			expect(await buf.asString()).toBe('abcABC');
		});
	});

	describe('asUInt8Array', function (): void {
		it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyz');
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
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			buf.write(new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]));
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyzabcdefjklmnopqrstuvwxyz');
		});

		it('asUInt8Array with different types in constructor and same NaniumBuffer written again to itself\n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			buf.write(buf);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyzabcdefjklmnopqrstuvwxyz');
		});

		it('asUInt8Array with bigger internal buffer than data\n', async () => {
			const largeBuffer = new ArrayBuffer(100); // 100 bytes buffer
			const smallView = new Uint8Array(largeBuffer, 10, 3); // only 3 bytes starting at offset 10
			smallView[0] = 65; // 'A'
			smallView[1] = 66; // 'B'
			smallView[2] = 67; // 'C'
			const buf = new NaniumBuffer([arrayBuffer, smallView]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcABC');
		});
	});

	describe('as())', function (): void {
		it('as(Buffer) with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			const b = await buf.as(Buffer);
			expect(b instanceof Buffer).toBeTruthy();
			expect(new TextDecoder().decode(new Uint8Array(b as any, b.byteOffset, b.byteLength))).toBe('abcdefjklmnopqrstuvwxyz');
		});

		it('as(ArrayBuffer) with Buffer with smaller byteLength than the underlying ArrayBuffer \n', async function (): Promise<void> {
			const b: Buffer = Buffer.from(new TextEncoder().encode('abcdefghijklmn').buffer, 5, 3);
			const ab: ArrayBuffer = await NaniumBuffer.as(ArrayBuffer, b);
			expect(ab instanceof ArrayBuffer).toBeTruthy();
			expect(new TextDecoder().decode(ab)).toBe('fgh');
		});

		it('as(ArrayBuffer) with bigger internal buffer than data\n', async () => {
			const largeBuffer = new ArrayBuffer(100); // 100 bytes buffer
			const smallView = new Uint8Array(largeBuffer, 10, 3); // only 3 bytes starting at offset 10
			smallView[0] = 65; // 'A'
			smallView[1] = 66; // 'B'
			smallView[2] = 67; // 'C'
			const buf = await (new NaniumBuffer([arrayBuffer, smallView])).as(ArrayBuffer);
			expect(new TextDecoder().decode(new Uint8Array(buf))).toBe('abcABC');
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
		buf.write(dataView);
		buf.write(blob);
		expect(buf.length).toBe(17);
		expect(await buf.asString()).toBe('mnopjklqrstuvwxyz');
		buf.clear();
		expect(buf.length).toBe(0);
	});

	it('--> slice \n', async function (): Promise<void> {
		const buf = new NaniumBuffer([
			arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
		]);
		expect(await buf.asString()).toBe('abcdefjklmnopqrstuvwxyz');
		expect(await buf.slice(0).asString()).toBe('abcdefjklmnopqrstuvwxyz');
		expect(await buf.slice(0, 3).asString()).toBe('abc');
		expect(await buf.slice(0, 4).asString()).toBe('abcd');
		expect(await buf.slice(0, -1).asString()).toBe('abcdefjklmnopqrstuvwxy');
		expect(await buf.slice(1, -1).asString()).toBe('bcdefjklmnopqrstuvwxy');
		expect(await buf.slice(3, -1).asString()).toBe('defjklmnopqrstuvwxy');
		expect(await buf.slice(4, -1).asString()).toBe('efjklmnopqrstuvwxy');
		expect(await buf.slice(6, -1).asString()).toBe('jklmnopqrstuvwxy');
		expect(await buf.slice(7, -1).asString()).toBe('klmnopqrstuvwxy');
		expect(await buf.slice(9, -1).asString()).toBe('mnopqrstuvwxy');
		expect(await buf.slice(10, -1).asString()).toBe('nopqrstuvwxy');
		expect(await buf.slice(13, -1).asString()).toBe('qrstuvwxy');
		expect(await buf.slice(14, -1).asString()).toBe('rstuvwxy');
		expect(await buf.slice(17, -1).asString()).toBe('uvwxy');
		expect(await buf.slice(18, -1).asString()).toBe('vwxy');
		expect(await buf.slice(21, -1).asString()).toBe('y');
		expect(await buf.slice(22, -1).asString()).toBe('');

		expect(await buf.slice(1, -4).asString()).toBe('bcdefjklmnopqrstuv');
		expect(await buf.slice(1, -5).asString()).toBe('bcdefjklmnopqrstu');
		expect(await buf.slice(1, -8).asString()).toBe('bcdefjklmnopqr');
		expect(await buf.slice(1, -9).asString()).toBe('bcdefjklmnopq');
		expect(await buf.slice(1, -11).asString()).toBe('bcdefjklmno');
		expect(await buf.slice(1, -12).asString()).toBe('bcdefjklmn');
		expect(await buf.slice(1, -14).asString()).toBe('bcdefjkl');
		expect(await buf.slice(1, -15).asString()).toBe('bcdefjk');
		expect(await buf.slice(0, -15).asString()).toBe('abcdefjk');
	});

	it('--> readFloat32LE \n', async function (): Promise<void> {
		let buf = await NaniumBufferReadable.from(uint8Array, new Int16Array([-12]), buffer32);
		expect((buf.readInt16LE(3))).toBe(-12);
		buf = await NaniumBufferReadable.from(uint8Array, new Int32Array([-12]), buffer32);
		expect((buf.readInt32LE(3))).toBe(-12);

		buf = await NaniumBufferReadable.from(uint8Array, new Uint16Array([12]), buffer32);
		expect((buf.readUInt16LE(3))).toBe(12);
		buf = await NaniumBufferReadable.from(uint8Array, new Uint32Array([12]), buffer32);
		expect((buf.readUInt32LE(3))).toBe(12);

		buf = await NaniumBufferReadable.from(uint8Array, new Float32Array([12.345]), buffer32);
		expect((buf.readFloat32LE(3)).toFixed(6)).toBe('12.345000');
		buf = await NaniumBufferReadable.from(uint8Array, new Float64Array([12.3456789012345]), buffer32);
		expect((buf.readFloat64LE(3)).toFixed(13)).toBe('12.3456789012345');
	});

	it('--> readUInt32BE \n', async function (): Promise<void> {
		const buf = new NaniumBuffer();
		buf.write(new Uint8Array([0x12, 0x34, 0x56, 0x78])) // (Big-Endian)
		buf.write(new Uint8Array([0xAB, 0xCD, 0xEF, 0x00])) // (Big-Endian)
		buf.write(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])) // (Big-Endian)
		const rb = await NaniumBufferReadable.from(buf);
		expect(rb.readUInt32BE(0)).toBe(0x12345678);
		expect(rb.readUInt32BE(4)).toBe(0xABCDEF00);
		expect(rb.readUInt32BE(8)).toBe(0xDEADBEEF);
	});

	it('--> readString \n', async function (): Promise<void> {
		const buf = new NaniumBuffer();
		buf.writeInt32LE(2);
		buf.write(new TextEncoder().encode('abcdef'));
		expect((await buf.asReadable()).readString(5, 4)).toBe('abcde');
	});

	it('--> readSequential \n', async function (): Promise<void> {
		const buf = new NaniumBuffer();
		buf.writeInt32LE(2);
		buf.writeFloat64LE(3.56);
		buf.writeInt8(4);
		buf.writeString('abcdef');
		buf.writeInt8(5);
		const rb = await buf.asReadable();
		expect(rb.readInt32LE()).toBe(2);
		expect(rb.readFloat64LE()).toBe(3.56);
		expect(rb.readInt8()).toBe(4);
		expect(rb.readString(5)).toBe('abcde');
		expect(rb.readString(1)).toBe('f');
		expect(rb.eof).toBeFalsy();
		expect(rb.readInt8()).toBe(5);
		expect(rb.eof).toBeTruthy();
	});

	it('--> writeString \n', async function (): Promise<void> {
		const buf = new NaniumBuffer();
		buf.writeInt32LE(2);
		buf.writeString('abc');
		const result = new TextDecoder('utf-8').decode(await (buf.slice(4, 7)).asUint8Array());
		expect(result).toBe('abc');
	});

	it('--> write \n', async function (): Promise<void> {
		let buf = new NaniumBuffer();
		buf.writeInt32LE(3);
		buf.writeFloat32LE(8.5);
		let bytes = Array.from(await buf.asUint8Array());
		expect(bytes[0]).toBe(parseInt('00000011', 2));
		expect(bytes[1]).toBe(parseInt('00000000', 2));
		expect(bytes[2]).toBe(parseInt('00000000', 2));
		expect(bytes[3]).toBe(parseInt('00000000', 2));

		expect(bytes[4]).toBe(parseInt('00000000', 2));
		expect(bytes[5]).toBe(parseInt('00000000', 2));
		expect(bytes[6]).toBe(parseInt('00001000', 2));
		expect(bytes[7]).toBe(parseInt('01000001', 2));

		buf = new NaniumBuffer();
		buf.writeInt32BE(3);
		buf.writeFloat32BE(8.5);
		bytes = Array.from(await buf.asUint8Array());
		expect(bytes[0]).toBe(parseInt('00000000', 2));
		expect(bytes[1]).toBe(parseInt('00000000', 2));
		expect(bytes[2]).toBe(parseInt('00000000', 2));
		expect(bytes[3]).toBe(parseInt('00000011', 2));

		expect(bytes[4]).toBe(parseInt('01000001', 2));
		expect(bytes[5]).toBe(parseInt('00001000', 2));
		expect(bytes[6]).toBe(parseInt('00000000', 2));
		expect(bytes[7]).toBe(parseInt('00000000', 2));
	});
});
