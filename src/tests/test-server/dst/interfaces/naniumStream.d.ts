import { ConstructorType } from '../objects.js';
import { NaniumBuffer } from './naniumBuffer.js';
export declare class NaniumStream<T = any> implements AsyncIterable<T> {
    #private;
    id: string;
    static naniumIsNaniumStreamSymbol: symbol;
    constructor(/*itemConstructor?: new (...data: any) => T, genericTypeInfo?: NaniumGenericTypeInfo,*/ id?: string);
    write(value: T): void;
    error(err: any): void;
    end(): void;
    [Symbol.asyncIterator](): AsyncIterator<T>;
    private next;
    pipeTo(destination: NaniumStream<T>): void;
    toPromise(): Promise<T extends NaniumBuffer ? NaniumBuffer : T[]>;
    static forEachStream(obj: object, fn: (stream: NaniumStream, type: ConstructorType) => void): void;
    static isNaniumStream(objectOrConstructor: ConstructorType | object): boolean;
}
