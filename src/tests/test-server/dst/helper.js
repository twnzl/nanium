export class DateHelper {
    static addSeconds(secondsToAdd, date) {
        const result = new Date(date);
        result.setSeconds(result.getSeconds() + secondsToAdd);
        return result;
    }
}
export class AsyncHelper {
    static async parallel(array, fn) {
        const promises = [];
        array.forEach((item) => promises.push(fn(item)));
        return await Promise.all(promises);
    }
    static async pause(milliseconds) {
        await new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }
    static async waitUntil(isReady, checkInterval = 50, timeout = 10000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const checkFn = () => {
                try {
                    if (isReady()) {
                        resolve();
                    }
                    else {
                        if (start + timeout < Date.now()) {
                            reject(new Error('timeout'));
                        }
                        else {
                            setTimeout(checkFn, checkInterval);
                        }
                    }
                }
                catch (e) {
                    reject(e);
                }
            };
            setTimeout(checkFn, checkInterval);
        });
    }
}
export class Mutex {
    constructor() {
        this.currentPromise = Promise.resolve();
    }
    /**
     * Queues an action.
     * The action will not start until all previous actions are completed
     * (regardless of whether they succeeded or failed).
     */
    async dispatch(action) {
        // We remember the current "tail" of the queue
        const previousPromise = this.currentPromise;
        // We create a new Promise that waits for the previous one and then executes the action
        const resultPromise = previousPromise.then(() => action());
        // update the "tail" of the queue.
        // catching errors here is important to prevent, that a failed action
        // does not block the queue for subsequent actions.
        this.currentPromise = resultPromise.catch(() => { });
        // We return the result (or error) to the caller
        return resultPromise;
    }
}
/**
 * Wrapper for Mutex class to prevent that two or more asynchronous calls
 * of an asynchronous action will never run parallel
 */
export function criticalSection(mutex, action) {
    return mutex.dispatch(action);
}
export class ExtendedPromise extends Promise {
    #timeoutId;
    constructor(executor = (_rs, _rj) => { }, timeout) {
        let resolve, reject;
        super((res, rej) => {
            resolve = res;
            reject = rej;
            executor(res, rej);
        });
        this.isResolved = false;
        this.isPending = false;
        this.#timeoutId = undefined;
        this.resolve = (value) => {
            if (this.#timeoutId) {
                clearTimeout(this.#timeoutId);
            }
            resolve(value);
            this.isResolved = true;
            this.isPending = false;
        };
        this.reject = reject;
        this.isResolved = false;
        this.isPending = true;
        if (timeout) {
            this.#timeoutId = setTimeout(() => {
                this.reject(new Error('timeout'));
            }, timeout);
        }
    }
    cancel(msg = 'canceled') {
        if (this.isPending) {
            this.reject(new Error(msg));
        }
    }
}
export class ExtendedTimeout {
    #timeoutId = undefined;
    #milliseconds = undefined;
    #callback;
    constructor(callback, milliseconds) {
        this.restart(milliseconds, callback);
    }
    restart(milliseconds, callback) {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
        }
        this.#milliseconds = milliseconds ?? this.#milliseconds;
        this.#callback = callback ?? this.#callback;
        this.#timeoutId = setTimeout(this.#callback, this.#milliseconds);
    }
    cancel() {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
        }
    }
}
export function setExtendedTimeout(callback, milliseconds) {
    return new ExtendedTimeout(callback, milliseconds);
}
let uuidCounter = 0;
export function uuid() {
    return Date.now() + '-' + Math.random().toFixed(20).substring(2) + '-' + (++uuidCounter);
}
//# sourceMappingURL=helper.js.map