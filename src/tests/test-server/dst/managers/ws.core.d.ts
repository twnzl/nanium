import { NaniumBuffer } from '../interfaces/naniumBuffer.js';
import { NaniumStream } from '../interfaces/naniumStream.js';
import { NaniumSerializer } from '../interfaces/serializer.js';
import { WsMessage, WsMessageType } from './providers/channels/ws.types.js';
export declare function sendMessage(msg: WsMessage, serializer: NaniumSerializer, send: (data: string | ArrayBuffer | Uint8Array) => Promise<void>, chunk?: NaniumBuffer): Promise<void>;
export declare function sendBufferInChunks(buffer: NaniumBuffer | ArrayBuffer | Uint8Array, requestId: string, send: (data: string | ArrayBuffer) => Promise<void>, messageType: WsMessageType, serializer: NaniumSerializer, binaryChunkSize?: number, streamId?: string): Promise<void>;
export declare function parseMessage(data: any, serializer: NaniumSerializer): Promise<WsMessage>;
export declare function initStream(stream: NaniumStream<any>, subType: any, requestId: string, send: (data: string | ArrayBuffer) => Promise<void>, serializer: NaniumSerializer, binaryChunkSize?: number): void;
