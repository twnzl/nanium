import { NaniumLogger } from '../interfaces/logger.js';
import { NaniumBuffer } from '../interfaces/naniumBuffer.js';
import { WsMessage, WsServiceChunkMessage } from './providers/channels/ws.types.js';
export async function sendMessage(msg, serializer, send, chunk) {
    const serialized = serializer.serialize(msg);
    const msgBuffer = new NaniumBuffer();
    if (typeof serialized === 'string') {
        msgBuffer.write(new TextEncoder().encode(serialized));
    }
    else {
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
export async function sendBufferInChunks(buffer, requestId, send, messageType, serializer, binaryChunkSize = 1024 * 1024, streamId) {
    const data = NaniumBuffer.isNaniumBuffer(buffer) ? buffer : new NaniumBuffer(buffer);
    const totalBytes = data.length;
    const totalChunks = Math.ceil(totalBytes / binaryChunkSize);
    try {
        for (let i = 0; i < totalChunks; i++) {
            const start = i * binaryChunkSize;
            const end = Math.min(start + binaryChunkSize, totalBytes);
            const chunk = data.slice(start, end);
            // create message/header as binary buffer
            const msg = new WsMessage({
                type: messageType,
                content: new WsServiceChunkMessage({
                    requestId: requestId,
                    bufferOrStreamId: streamId ?? data.id,
                    totalBytes: totalBytes,
                    isLastChunk: i === (totalChunks - 1),
                })
            }, { 'TContent': WsServiceChunkMessage });
            await sendMessage(msg, serializer, send, chunk);
            // todo: progress info - maybe as Nanium event
            // if (onProgress) {
            // 	const progress = ((i + 1) / totalChunks) * 100;
            // 	onProgress(progress);
            // }
        }
    }
    catch (error) {
        NaniumLogger.error('channel ws: sendBufferInChunks: ', error?.message, error?.stack);
        throw error;
    }
}
export async function parseMessage(data /* Blob | ArrayBuffer | Buffer */, serializer) {
    let result;
    try {
        if (typeof data === 'string') {
            result = serializer.deserialize(data);
        }
        else {
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
    }
    catch (e) {
        result = new WsMessage({
            error: e,
            type: 'unknown'
        });
        return result;
    }
    return result;
}
export function initStream(stream, subType, requestId, send, serializer, binaryChunkSize = 1024 * 1024) {
    void (async () => {
        try {
            for await (const chunk of stream) {
                if (NaniumBuffer.isNaniumBuffer(subType)) {
                    await sendBufferInChunks(chunk, requestId, async (data) => await send(data), 'service_stream_chunk', serializer, binaryChunkSize, stream.id);
                }
                else {
                    const serialized = serializer.serialize(chunk);
                    await sendBufferInChunks(typeof serialized === 'string' ? new TextEncoder().encode(serialized) : serialized, requestId, async (chunk) => await send(chunk), 'service_stream_chunk', serializer, binaryChunkSize, stream.id);
                }
            }
            const msg = new WsMessage({
                type: 'service_stream_end',
                content: new WsServiceChunkMessage({
                    requestId: requestId,
                    bufferOrStreamId: stream.id,
                })
            }, { 'TContent': WsServiceChunkMessage });
            await sendMessage(msg, serializer, send);
        }
        catch (err) {
            const msg = new WsMessage({
                type: 'service_stream_error',
                content: new WsServiceChunkMessage({
                    requestId: requestId,
                    bufferOrStreamId: stream.id,
                }),
                error: err,
            }, { 'TContent': WsServiceChunkMessage });
            await sendMessage(msg, serializer, send);
        }
    })();
}
//# sourceMappingURL=ws.core.js.map