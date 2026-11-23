import { NaniumObject } from '../../objects.js';
export declare class ServiceResponseMessage {
    code?: string;
    text?: string;
    constructor(code?: string, text?: string);
}
export declare class ServiceResponseHead extends NaniumObject<ServiceResponseHead> {
    errors?: ServiceResponseMessage[];
    exceptions?: ServiceResponseMessage[];
}
export declare class ServiceResponseBase<TResponseBody> {
    head?: ServiceResponseHead;
    body?: TResponseBody;
    constructor(body?: TResponseBody, head?: ServiceResponseHead);
    static createError(code: string, text?: string): ServiceResponseBase<any>;
}
