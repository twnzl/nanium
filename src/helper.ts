export class DateHelper {
	static addSeconds(secondsToAdd: number, date?: Date): Date {
		const result: Date = new Date(date);
		result.setSeconds(result.getSeconds() + secondsToAdd);
		return result;
	}
}


export class AsyncHelper {
	static async pause(milliseconds: number): Promise<void> {
		await new Promise<unknown>((resolve: (value: unknown) => void): void => {
			setTimeout(resolve, milliseconds);
		});
	}
}
