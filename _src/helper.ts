export class DateHelper {
	static addSeconds(secondsToAdd: number, date?: Date): Date {
		const result: Date = new Date(date);
		result.setSeconds(result.getSeconds() + secondsToAdd);
		return result;
	}
}


export class AsyncHelper {
	static async parallel<TElement, TResult>(array: TElement[], fn: (e: TElement) => Promise<TResult>): Promise<TResult[]> {
		const promises: Promise<TResult>[] = [];
		array.forEach((item: TElement) => promises.push(fn(item)));
		return await Promise.all(promises);
	}

	static async pause(milliseconds: number): Promise<void> {
		await new Promise<unknown>((resolve: (value: unknown) => void): void => {
			setTimeout(resolve, milliseconds);
		});
	}

	static async waitUntil(isReady: () => boolean, checkInterval: number = 50, timeout: number = 10000): Promise<void> {
		const start: number = Date.now();
		return new Promise<void>((resolve, reject) => {
			const checkFn: Function = () => {
				try {
					if (isReady()) {
						resolve();
					} else {
						if (start + timeout < Date.now()) {
							reject(new Error('timeout'));
						} else {
							setTimeout(checkFn, checkInterval);
						}
					}
				} catch (e) {
					reject(e);
				}
			};
			setTimeout(checkFn, checkInterval);
		});
	}
}

export class Mutex {
	private currentPromise: Promise<unknown> = Promise.resolve();

	/**
	 * Queues an action.
	 * The action will not start until all previous actions are completed
	 * (regardless of whether they succeeded or failed).
	 */
	async dispatch<T>(action: () => Promise<T> | T): Promise<T> {
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
export function criticalSection<T>(mutex: Mutex, action: () => Promise<T> | T): Promise<T> {
	return mutex.dispatch(action);
}

export type ResolveFunction<T = unknown> = (result?: T) => void;
export type RejectFunction = (error?: unknown) => void;
