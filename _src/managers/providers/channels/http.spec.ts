import { MultipartParser, NaniumHttpChannelConfig } from './http';
import { NaniumJsonSerializer } from '../../../serializers/json';
import { TestBufferExecutor } from '../../../tests/services/test/buffer.executor';
import { TestBufferRequest } from '../../../tests/services/test/buffer.contract';

const requestBody = Buffer.from(
	'------WebKitFormBoundaryLkLCIZyhA3PyKWAf\r\n' +
	'Content-Disposition: form-data; name="request"\r\n\r\n' +
	'{"serviceName":"NaniumTest:test/buffer","request":{"body":{"id":"1","buffer1":{"id":"1665403153976-42965008940091142797157"},"buffer2":{"id":"1665403153976-28825600714261789825158"}},"head":{"token":"1234"}}}\r\n' +
	'------WebKitFormBoundaryLkLCIZyhA3PyKWAf\r\n' +
	'Content-Disposition: form-data; name="1665403153976-42965008940091142797157"; filename="blob"\r\n' +
	'Content-Type: application/octet-stream\r\n\r\n' +
	'123\r\n' +
	'------WebKitFormBoundaryLkLCIZyhA3PyKWAf\r\n' +
	'Content-Disposition: form-data; name="1665403153976-28825600714261789825158"; filename="blob"\r\n' +
	'Content-Type: application/octet-stream\r\n\r\n' +
	'456\r\n' +
	'------WebKitFormBoundaryLkLCIZyhA3PyKWAf--');


describe('NaniumChannelHttp \n', function (): void {

	let parser: MultipartParser;

	async function coreTest() {
		const result = await parser.getResult();
		expect(result[0].body.id).toBe('1');
		expect(result[0].body.buffer1.id).toBe('1665403153976-42965008940091142797157');
		expect(await result[0].body.buffer1.asString()).toBe('123');
		expect(result[0].body.buffer2.id).toBe('1665403153976-28825600714261789825158');
		expect(await result[0].body.buffer2.asString()).toBe('456');
	}

	beforeEach(async function (): Promise<void> {
		parser = new MultipartParser(
			'multipart/form-data; boundary=----WebKitFormBoundaryLkLCIZyhA3PyKWAf',
			{ 'serializer': new NaniumJsonSerializer() } as NaniumHttpChannelConfig,
			{
				'NaniumTest:test/buffer': {
					Executor: TestBufferExecutor,
					Request: TestBufferRequest,
				},
			}
		);
	});

	it('--> Request with buffers one transmission with the whole body \n', async function (): Promise<void> {
		await parser.parsePart(requestBody);
		await coreTest();
	});

	it('--> Request with buffers and transmission break at the beginning of buffer content \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 481));
		await parser.parsePart(requestBody.slice(481));
		await coreTest();
	});

	it('--> Request with buffers and transmission break between buffer content \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 482));
		await parser.parsePart(requestBody.slice(482));
		await coreTest();
	});

	it('--> Request with buffers and transmission break at the end of buffer content \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 484));
		await parser.parsePart(requestBody.slice(484));
		await coreTest();
	});

	it('--> Request with buffers and transmission between the end marks of buffer content \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 485));
		await parser.parsePart(requestBody.slice(485));
		await coreTest();
	});

	it('--> Request with buffers and transmission break between request content \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 100));
		await parser.parsePart(requestBody.slice(100));
		await coreTest();
	});

	it('--> Request with buffers and transmission break between fieldName \n', async function (): Promise<void> {
		await parser.parsePart(requestBody.slice(0, 482));
		await parser.parsePart(requestBody.slice(482));
		await coreTest();
	});

	it('--> parallel calls to parsePart \n', async function (): Promise<void> {
		await Promise.all([
			parser.parsePart(requestBody.slice(0, 482)),
			parser.parsePart(requestBody.slice(482))
		]);
		await coreTest();
	});
});
