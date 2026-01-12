import { beforeEach, describe, expect, it } from 'vitest';
import { LogLevel, NaniumLogger } from "../../interfaces/logger";
import { NaniumBuffer } from "../../interfaces/naniumBuffer";
import { TestLogger } from "../testLogger";


describe('NaniumBuffer \n', function (): void {
	const arrayBuffer: ArrayBuffer = new TextEncoder().encode('abc').buffer;
	const blob = new Blob(['def']);
	const file: File = new File([new Blob(['fff'])], 'test.bin');
	const uint8Array = new TextEncoder().encode('jkl');

	beforeEach(() => {
		NaniumLogger.addLogger(new TestLogger(LogLevel.error));
	});

	describe('asString', function (): void {
		it('with different types in constructor', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, blob, uint8Array, file
			]);
			expect(buf.id?.length > 0).toBeTruthy();
			expect(await buf.asString()).toBe('abcdefjklfff');
		});

		it('asString with a single arrayBuffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([arrayBuffer]);
			expect(await buf.asString()).toBe('abc');
		});

		it('asString write multiple different types', async function (): Promise<void> {
			const buf = new NaniumBuffer(undefined, '1');
			expect(buf.id).toBe('1');
			buf.write(arrayBuffer);
			buf.write(blob);
			buf.write(uint8Array);
			buf.write(file);
			expect(await buf.asString()).toBe('abcdefjklfff');
		});
	});

	describe('asUInt8Array', function (): void {
		it('asUInt8Array with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, blob, uint8Array, file
			]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abcdefjklfff');
		});

		it('asUInt8Array with a single arrayBuffer', async function (): Promise<void> {
			const buf = new NaniumBuffer([arrayBuffer]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('abc');
		});

		it('asUInt8Array with a single Blob', async function (): Promise<void> {
			const buf = new NaniumBuffer([blob]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('def');
		});

		it('asUInt8Array with a single File', async function (): Promise<void> {
			const buf = new NaniumBuffer([file]);
			expect(new TextDecoder().decode(await buf.asUint8Array())).toBe('fff');
		});
	});

	describe('as())', function (): void {
		it('as(Blob) with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, blob, uint8Array, file
			]);
			const b = await buf.as(Blob);
			expect(b instanceof Blob).toBeTruthy();
			expect(new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()))).toBe('abcdefjklfff');
		});
	});

	describe('splice())', function (): void {
		it('splice(Buffer) with different types in constructor \n', async function (): Promise<void> {
			const buf = new NaniumBuffer([
				arrayBuffer, blob, uint8Array, file
			]);
			expect(await buf.slice(3, 6).asString()).toBe('def');
			expect(await buf.slice(3, 5).asString()).toBe('de');
			expect(await buf.slice(4, 6).asString()).toBe('ef');
			expect(await buf.slice(4, 7).asString()).toBe('efj');
			expect(await buf.slice(9, 12).asString()).toBe('fff');
			expect(await buf.slice(2, 7).asString()).toBe('cdefj');
		});
	});
});
