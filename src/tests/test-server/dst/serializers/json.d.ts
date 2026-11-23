import { NaniumSerializer } from '../interfaces/serializer.js';
export declare class NaniumJsonSerializer implements NaniumSerializer {
    packageSeparator: string;
    mimeType: string;
    constructor(packageSeparator?: string, mimeType?: string);
    deserialize(raw: string | ArrayBuffer | ArrayBufferView): any;
    serialize(obj: any): string | ArrayBuffer;
    serializePartial(obj: any): string | ArrayBuffer;
    deserializePartial(raw: string | ArrayBuffer | ArrayBufferView, restFromLastTime?: string): {
        data: any;
        rest: any;
    };
}
