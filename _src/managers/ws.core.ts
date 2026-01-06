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
		msgBuffer.write(new TextEncoder().encode(serialized as string));
	} else {
		msgBuffer.write(serialized);
	}
	const message = new NaniumBuffer();
	message.writeUInt32LE(msgBuffer.length);
	message.write(msgBuffer);
	if (chunk) {
		message.write(chunk);
	}
	await send(await message.asUint8Array());
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
		Nanium.logger.error('channel ws: sendBufferInChunks: ', error?.message, error?.stack);
		throw error;
	}
}

export async function parseMessage(data: any /* Blob | ArrayBuffer | Buffer */, serializer: NaniumSerializer): Promise<WsMessage> {
	let result: WsMessage;
	try {
		if (typeof data === 'string') {
			result = serializer.deserialize(data);
		} else {
			const nb = new NaniumBuffer(data);
			const headerLength = (await nb.asReadable()).readInt32LE(0);
			const binary = await nb.asArrayBuffer();
			if (headerLength < 0 || headerLength > data.length) {
				result = new WsMessage({
					error: 'bad message format',
					type: 'unknown'
				});
				return result;
			}
			const headerArray = new Uint8Array(binary, 4, headerLength);
			const headerJson = new TextDecoder().decode(headerArray);
			result = serializer.deserialize(headerJson);
			// extract appending data
			if (binary.byteLength > 4 + headerLength) {
				result.payload = new Uint8Array(binary, 4 + headerLength, binary.byteLength - 4 - headerLength);
			}
		}
	} catch (e) {
		result = new WsMessage({
			error: e,
			type: 'unknown'
		});
		return result;
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
	void (async () => {
		try {
			for await (const chunk of stream) {
				if (NaniumBuffer.isNaniumBuffer(subType)) {
					await sendBufferInChunks(chunk, requestId,
						async data => await send(data), 'service_stream_chunk',
						serializer, binaryChunkSize, stream.id);
				} else {
					const serialized = serializer.serialize(chunk);
					await sendBufferInChunks(typeof serialized === 'string' ? new TextEncoder().encode(serialized) : serialized, requestId,
						async chunk => await send(chunk), 'service_stream_chunk',
						serializer, binaryChunkSize, stream.id);
				}
			}

			const msg: WsMessage<WsServiceChunkMessage> = new WsMessage<WsServiceChunkMessage>({
				type: 'service_stream_end',
				content: new WsServiceChunkMessage({
					requestId: requestId,
					bufferOrStreamId: stream.id,
				})
			});
			await sendMessage(msg, serializer, send);
		} catch (err) {
			const msg: WsMessage<WsServiceChunkMessage> = new WsMessage<WsServiceChunkMessage>({
				type: 'service_stream_error',
				content: new WsServiceChunkMessage({
					requestId: requestId,
					bufferOrStreamId: stream.id,
				}),
				error: err,
			});
			await sendMessage(msg, serializer, send);
		}
	})();
}
