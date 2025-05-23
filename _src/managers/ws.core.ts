import { NaniumBuffer } from '../interfaces/naniumBuffer';
import { WsMessage, WsMessageType, WsServiceBufferChunkMessage } from './providers/channels/ws.types';
import { Nanium } from '../core';
import { NaniumSerializer } from '../interfaces/serializer';

export async function sendMessage(
	msg: WsMessage,
	serializer: NaniumSerializer,
	send: (data: string | ArrayBuffer) => void,
	chunk?: NaniumBuffer,
) {
	const serialized = serializer.serialize(msg);
	const msgBuffer = new NaniumBuffer();
	if (typeof serialized === 'string') {
		msgBuffer.write(new TextEncoder().encode(serialized as string));
	} else {
		msgBuffer.write(serialized);
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
		message.set(await chunk.asUint8Array(), 4 + msgBuffer.length);
	}

	await new Promise<void>((resolve, _reject) => {
		send(message);
		resolve();
	});
}

export async function sendBufferInChunks(
	buffer: NaniumBuffer | ArrayBuffer,
	requestId: string,
	send: (data: string | ArrayBuffer) => void,
	messageType: WsMessageType,
	serializer: NaniumSerializer,
	binaryChunkSize: number = 1024 * 1024,
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
			const msg = new WsMessage<WsServiceBufferChunkMessage>({ type: messageType });
			msg.content = new WsServiceBufferChunkMessage({
				requestId: requestId,
				bufferId: data.id,
				totalBytes: totalBytes,
				isLastChunk: i === totalChunks - 1,
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
	// DataView for reading the length of the message/header
	// const binary = data instanceof ArrayBuffer
	// 	? data
	// 	: data.arrayBuffer
	// 		? await data.arrayBuffer()
	// 		: null;
	// let headerLength: number;
	// if (binary) {
	// 	const dataView = new DataView(binary);
	// 	headerLength = dataView.getUint32(0, true);
	// } else {
	// 	headerLength = data.readUInt32LE(0);
	// }
	const nb = new NaniumBuffer(data);
	const headerLength = await nb.readInt32LE(0);
	const binary = await nb.asArrayBuffer();

	// extract and parse message/header
	const headerArray = new Uint8Array(binary, 4, headerLength);
	const headerJson = new TextDecoder().decode(headerArray);
	const result: WsMessage = serializer.deserialize(headerJson);

	// extract appending data
	if (binary.byteLength > 4 + headerLength) {
		result.payload = new Uint8Array(binary, 4 + headerLength, binary.byteLength - 4 - headerLength);
	}

	return result;
}
