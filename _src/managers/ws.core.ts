import { Nanium } from '../core';
import { NaniumBuffer } from '../interfaces/naniumBuffer';
import { NaniumStream } from '../interfaces/naniumStream';
import { NaniumSerializer } from '../interfaces/serializer';
import { WsMessage, WsMessageType, WsServiceChunkMessage } from './providers/channels/ws.types';

export async function sendMessage(
	msg: WsMessage,
	serializer: NaniumSerializer,
	send: (data: string | ArrayBuffer | Uint8Array) => Promise<void>,
	chunk?: NaniumBuffer,
) {
	const serialized = serializer.serialize(msg);
	const msgBuffer = new NaniumBuffer();
	if (typeof serialized === 'string') {
		await msgBuffer.write(new TextEncoder().encode(serialized as string));
	} else {
		await msgBuffer.write(serialized);
	}

	const headerLengthArray = new Uint8Array(4);
	new DataView(headerLengthArray.buffer)
		.setUint32(0, msgBuffer.length, true); // true for Little-Endian

	// total message: length of the message/header (4 byte number) + message + chunk
	const message = new Uint8Array(
		4 + msgBuffer.length + (chunk?.length ?? 0)
	);
	message.set(headerLengthArray, 0);
	message.set(await msgBuffer.asUint8Array(), 4);
	if (chunk) {
		const ui8a = await chunk.asUint8Array();
		message.set(ui8a, 4 + msgBuffer.length);
	}

	await send(message);
}

export async function sendBufferInChunks(
	buffer: NaniumBuffer | ArrayBuffer | Uint8Array,
	requestId: string,
	send: (data: string | ArrayBuffer) => Promise<void>,
	messageType: WsMessageType,
	serializer: NaniumSerializer,
	binaryChunkSize: number = 1024 * 1024,
	streamId?: string,
) {
	const data: NaniumBuffer = NaniumBuffer.isNaniumBuffer(buffer) ? buffer as NaniumBuffer : new NaniumBuffer(buffer);
	const totalBytes = data.length;
	const totalChunks = Math.ceil(totalBytes / binaryChunkSize);

	try {
		for (let i = 0; i < totalChunks; i++) {
			const start = i * binaryChunkSize;
			const end = Math.min(start + binaryChunkSize, totalBytes);
			const chunk = data.slice(start, end);

			// create message/header as binary buffer
			const msg: WsMessage<WsServiceChunkMessage> = new WsMessage<WsServiceChunkMessage>({
				type: messageType,
				content: new WsServiceChunkMessage({
					requestId: requestId,
					bufferOrStreamId: streamId ?? data.id,
					totalBytes: totalBytes,
					isLastChunk: i === (totalChunks - 1),
				})
			});
			await sendMessage(msg, serializer, send, chunk);

			// todo: progress info - maybe as Nanium event
			// if (onProgress) {
			// 	const progress = ((i + 1) / totalChunks) * 100;
			// 	onProgress(progress);
			// }
		}
	} catch (error) {
		Nanium.logger.error('channel ws: sendBufferInChunks: ', error.message, error.stack);
		throw error;
	}
}

export async function parseMessage(data: any /* Blob | ArrayBuffer | Buffer */, serializer: NaniumSerializer): Promise<WsMessage> {
	let result: WsMessage;
	if (typeof data === 'string') {
		result = serializer.deserialize(data);
	} else {
		const nb = new NaniumBuffer(data);
		const headerLength = (await nb.asReadable()).readInt32LE(0);
		const binary = await nb.asArrayBuffer();
		const headerArray = new Uint8Array(binary, 4, headerLength);
		const headerJson = new TextDecoder().decode(headerArray);
		result = serializer.deserialize(headerJson);
		// extract appending data
		if (binary.byteLength > 4 + headerLength) {
			result.payload = new Uint8Array(binary, 4 + headerLength, binary.byteLength - 4 - headerLength);
		}
	}

	return result;
}

export function initStream(
	stream: NaniumStream<any>,
	subType: any,
	requestId: string,
	send: (data: string | ArrayBuffer) => Promise<void>,
	serializer: NaniumSerializer,
	binaryChunkSize: number = 1024 * 1024,
) {
	stream.onData(async data => {
		if (NaniumBuffer.isNaniumBuffer(subType)) {
			await sendBufferInChunks(data, requestId,
				async data => await send(data), 'service_stream_chunk',
				serializer, binaryChunkSize, stream.id);
		} else {
			const serialized = serializer.serialize(data);
			await sendBufferInChunks(typeof serialized === 'string' ? new TextEncoder().encode(serialized) : serialized, requestId,
				async chunk => await send(chunk), 'service_stream_chunk',
				serializer, binaryChunkSize, stream.id);
		}
	});
	stream.onEnd(() => {
		send(
			serializer.serialize(new WsMessage<WsServiceChunkMessage>({
				type: 'service_stream_end',
				content: {
					requestId,
					bufferOrStreamId: stream.id
				}
			}))
		);
	});
	stream.onError(error => {
		this.websocket.send(serializer.serialize(new WsMessage<WsServiceChunkMessage>({
			type: 'service_stream_error',
			content: {
				bufferOrStreamId: stream.id,
				requestId
			},
			error: error,
		})));
	});
}
