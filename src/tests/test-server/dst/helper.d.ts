export declare class DateHelper {
    static addSeconds(secondsToAdd: number, date?: Date): Date;
}
export declare class AsyncHelper {
    static parallel<TElement, TResult>(array: TElement[], fn: (e: TElement) => Promise<TResult>): Promise<TResult[]>;
    static pause(milliseconds: number): Promise<void>;
    static waitUntil(isReady: () => boolean, checkInterval?: number, timeout?: number): Promise<void>;
}
export declare class Mutex {
    private currentPromise;
    /**
     * Queues an action.
     * The action will not start until all previous actions are completed
     * (regardless of whether they succeeded or failed).
     */
    dispatch<T>(action: () => Promise<T> | T): Promise<T>;
}
/**
 * Wrapper for Mutex class to prevent that two or more asynchronous calls
 * of an asynchronous action will never run parallel
 */
export declare function criticalSection<T>(mutex: Mutex, action: () => Promise<T> | T): Promise<T>;
export type ResolveFunction<T = unknown> = (result: T) => void;
export type RejectFunction = (error?: unknown) => void;
export declare class ExtendedPromise<T = void> extends Promise<T> {
    #private;
    resolve: (value?: T) => void;
    reject: (reason?: unknown) => void;
    isResolved: boolean;
    isPending: boolean;
    constructor(executor?: (_rs: (result: T) => void, _rj: (err: unknown) => void) => void, timeout?: number);
    cancel(msg?: string): void;
}
export declare class ExtendedTimeout {
    #private;
    constructor(callback: (...args: unknown[]) => void, milliseconds?: number);
    restart(milliseconds?: number, callback?: (...args: unknown[]) => void): void;
    cancel(): void;
}
export declare function setExtendedTimeout(callback: (...args: unknown[]) => void, milliseconds?: number): ExtendedTimeout;
export declare function uuid(): string;
