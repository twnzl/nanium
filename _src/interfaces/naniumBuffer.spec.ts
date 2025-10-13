import { Blob } from 'node:buffer';
import { NaniumBuffer } from './naniumBuffer';
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
		expect(NaniumBuffer.isNaniumBuffer(await NaniumBuffer.create())).toBeTruthy();
		expect(NaniumBuffer.isNaniumBuffer(new NaniumStream())).toBeFalsy();
	});

	describe('asString', function (): void {
		it('with different types in constructor', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			expect(buf.id?.length > 0).toBeTruthy();
			expect(buf.asString()).toBe('abcdefjklmnopqrstuvwxyz');
		});

		it('asString with a single arrayBuffer', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([arrayBuffer]);
			expect(buf.asString()).toBe('abc');
		});

		it('asString with a single float32Array', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([float32Array]);
			expect(buf.asString()).toBe('mnop');
		});

		it('asString write multiple different types', async function (): Promise<void> {
			const buf = await NaniumBuffer.create(undefined, '1');
			expect(buf.id).toBe('1');
			await buf.write(arrayBuffer);
			await buf.write(buffer);
			await buf.write(uint8Array);
			expect(buf.asString()).toBe('abcdefjkl');
		});

		it('asString with bigger internal buffer than data\n', async () => {
			const largeBuffer = new ArrayBuffer(100); // 100 bytes buffer
			const smallView = new Uint8Array(largeBuffer, 10, 3); // only 3 bytes starting at offset 10
			smallView[0] = 65; // 'A'
			smallView[1] = 66; // 'B'
			smallView[2] = 67; // 'C'
			const buf = await NaniumBuffer.create([arrayBuffer, smallView]);
			expect(buf.asString()).toBe('abcABC');
		});
	});

	describe('asUInt8Array', function (): void {
		it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyz');
		});

		it('asUInt8Array with a single arrayBuffer', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([arrayBuffer]);
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('abc');
		});

		it('asUInt8Array with a single Buffer', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([buffer]);
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('def');
		});

		it('asUInt8Array with different types in constructor and additional NaniumBuffer written\n', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			await buf.write(await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]));
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyzabcdefjklmnopqrstuvwxyz');
		});

		it('asUInt8Array with different types in constructor and same NaniumBuffer written again to itself\n', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			await buf.write(buf);
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('abcdefjklmnopqrstuvwxyzabcdefjklmnopqrstuvwxyz');
		});

		it('asUInt8Array with bigger internal buffer than data\n', async () => {
			const largeBuffer = new ArrayBuffer(100); // 100 bytes buffer
			const smallView = new Uint8Array(largeBuffer, 10, 3); // only 3 bytes starting at offset 10
			smallView[0] = 65; // 'A'
			smallView[1] = 66; // 'B'
			smallView[2] = 67; // 'C'
			const buf = await NaniumBuffer.create([arrayBuffer, smallView]);
			expect(new TextDecoder().decode(buf.asUint8Array())).toBe('abcABC');
		});
	});

	describe('as())', function (): void {
		it('as(Buffer) with different types in constructor \n', async function (): Promise<void> {
			const buf = await NaniumBuffer.create([
				arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
			]);
			const b = buf.as(Buffer);
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
			const buf = (await NaniumBuffer.create([arrayBuffer, smallView])).as(ArrayBuffer);
			expect(new TextDecoder().decode(new Uint8Array(buf))).toBe('abcABC');
		});
	});

	it('clear & length=0', async function (): Promise<void> {
		const buf = await NaniumBuffer.create(undefined, '1');
		expect(buf.id).toBe('1');
		await buf.write(arrayBuffer);
		await buf.write(buffer);
		expect(buf.length).toBe(6);
		expect(buf.asString()).toBe('abcdef');
		await buf.clear();
		expect(buf.length).toBe(0);
		await buf.write(float32Array);
		await buf.write(uint8Array);
		await buf.write(buffer32);
		await buf.write(dataView);
		await buf.write(blob);
		expect(buf.length).toBe(17);
		expect(buf.asString()).toBe('mnopjklqrstuvwxyz');
		buf.clear();
		expect(buf.length).toBe(0);
	});

	it('--> slice \n', async function (): Promise<void> {
		const buf = await NaniumBuffer.create([
			arrayBuffer, buffer, uint8Array, float32Array, buffer32, dataView, blob
		]);
		expect(buf.asString()).toBe('abcdefjklmnopqrstuvwxyz');
		expect(buf.slice(0).asString()).toBe('abcdefjklmnopqrstuvwxyz');
		expect(buf.slice(0, 3).asString()).toBe('abc');
		expect(buf.slice(0, 4).asString()).toBe('abcd');
		expect(buf.slice(0, -1).asString()).toBe('abcdefjklmnopqrstuvwxy');
		expect(buf.slice(1, -1).asString()).toBe('bcdefjklmnopqrstuvwxy');
		expect(buf.slice(3, -1).asString()).toBe('defjklmnopqrstuvwxy');
		expect(buf.slice(4, -1).asString()).toBe('efjklmnopqrstuvwxy');
		expect(buf.slice(6, -1).asString()).toBe('jklmnopqrstuvwxy');
		expect(buf.slice(7, -1).asString()).toBe('klmnopqrstuvwxy');
		expect(buf.slice(9, -1).asString()).toBe('mnopqrstuvwxy');
		expect(buf.slice(10, -1).asString()).toBe('nopqrstuvwxy');
		expect(buf.slice(13, -1).asString()).toBe('qrstuvwxy');
		expect(buf.slice(14, -1).asString()).toBe('rstuvwxy');
		expect(buf.slice(17, -1).asString()).toBe('uvwxy');
		expect(buf.slice(18, -1).asString()).toBe('vwxy');
		expect(buf.slice(21, -1).asString()).toBe('y');
		expect(buf.slice(22, -1).asString()).toBe('');

		expect(buf.slice(1, -4).asString()).toBe('bcdefjklmnopqrstuv');
		expect(buf.slice(1, -5).asString()).toBe('bcdefjklmnopqrstu');
		expect(buf.slice(1, -8).asString()).toBe('bcdefjklmnopqr');
		expect(buf.slice(1, -9).asString()).toBe('bcdefjklmnopq');
		expect(buf.slice(1, -11).asString()).toBe('bcdefjklmno');
		expect(buf.slice(1, -12).asString()).toBe('bcdefjklmn');
		expect(buf.slice(1, -14).asString()).toBe('bcdefjkl');
		expect(buf.slice(1, -15).asString()).toBe('bcdefjk');
		expect(buf.slice(0, -15).asString()).toBe('abcdefjk');
	});

	it('--> readFloat32LE \n', async function (): Promise<void> {
		let buf = await NaniumBuffer.create([uint8Array, new Int16Array([-12]), buffer32]);
		expect((buf.readInt16LE(3))).toBe(-12);
		buf = await NaniumBuffer.create([uint8Array, new Int32Array([-12]), buffer32]);
		expect((buf.readInt32LE(3))).toBe(-12);

		buf = await NaniumBuffer.create([uint8Array, new Uint16Array([12]), buffer32]);
		expect((buf.readUInt16LE(3))).toBe(12);
		buf = await NaniumBuffer.create([uint8Array, new Uint32Array([12]), buffer32]);
		expect((buf.readUInt32LE(3))).toBe(12);

		buf = await NaniumBuffer.create([uint8Array, new Float32Array([12.345]), buffer32]);
		expect((buf.readFloat32LE(3)).toFixed(6)).toBe('12.345000');
		buf = await NaniumBuffer.create([uint8Array, new Float64Array([12.3456789012345]), buffer32]);
		expect((buf.readFloat64LE(3)).toFixed(13)).toBe('12.3456789012345');
	});

	it('--> readUInt32BE \n', async function (): Promise<void> {
		const buf = await NaniumBuffer.create();
		await buf.write(new Uint8Array([0x12, 0x34, 0x56, 0x78])) // (Big-Endian)
		await buf.write(new Uint8Array([0xAB, 0xCD, 0xEF, 0x00])) // (Big-Endian)
		await buf.write(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])) // (Big-Endian)
		expect(buf.readUInt32BE(0)).toBe(0x12345678);
		expect(buf.readUInt32BE(4)).toBe(0xABCDEF00);
		expect(buf.readUInt32BE(8)).toBe(0xDEADBEEF);
	});

	it('--> readString \n', async function (): Promise<void> {
		const buf = await NaniumBuffer.create();
		buf.writeInt32LE(2);
		await buf.write(new TextEncoder().encode('abcdef'));
		expect(buf.readString(5, 4)).toBe('abcde');
	});

	it('--> readSequential \n', async function (): Promise<void> {
		const buf = await NaniumBuffer.create();
		buf.writeInt32LE(2);
		buf.writeFloat64LE(3.56);
		buf.writeInt8(4);
		buf.writeString('abcdef');
		buf.writeInt8(5);
		expect(buf.readInt32LE()).toBe(2);
		expect(buf.readFloat64LE()).toBe(3.56);
		expect(buf.readInt8()).toBe(4);
		expect(buf.readString(5)).toBe('abcde');
		expect(buf.readString(1)).toBe('f');
		expect(buf.readInt8()).toBe(5);
	});

	it('--> writeString \n', async function (): Promise<void> {
		const buf = await NaniumBuffer.create();
		buf.writeInt32LE(2);
		buf.writeString('abc');
		const result = new TextDecoder('utf-8').decode((buf.slice(4, 7)).asUint8Array());
		expect(result).toBe('abc');
	});

	it('--> write \n', async function (): Promise<void> {
		let buf = await NaniumBuffer.create();
		buf.writeInt32LE(3);
		buf.writeFloat32LE(8.5);
		let bytes = Array.from(buf.asUint8Array());
		expect(bytes[0]).toBe(parseInt('00000011', 2));
		expect(bytes[1]).toBe(parseInt('00000000', 2));
		expect(bytes[2]).toBe(parseInt('00000000', 2));
		expect(bytes[3]).toBe(parseInt('00000000', 2));

		expect(bytes[4]).toBe(parseInt('00000000', 2));
		expect(bytes[5]).toBe(parseInt('00000000', 2));
		expect(bytes[6]).toBe(parseInt('00001000', 2));
		expect(bytes[7]).toBe(parseInt('01000001', 2));

		buf = await NaniumBuffer.create();
		buf.writeInt32BE(3);
		buf.writeFloat32BE(8.5);
		bytes = Array.from(buf.asUint8Array());
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
