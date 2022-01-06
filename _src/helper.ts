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
