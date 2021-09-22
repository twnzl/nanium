const _realDate: DateConstructor = Date;

// @ts-ignore
export class DateMock extends Date implements DateConstructor {
	static value: Date;

	constructor(date?: Date | string | number) {
		super(date);
		if (!date) {
			this.setTime(DateMock.value.getTime());
		}
	}

	now(): number {
		return DateMock.value.getTime();
	}

	UTC(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number {
		return _realDate.UTC(year, month, date, hours, minutes, seconds, ms);
	}

	parse(s: string): number {
		return _realDate.parse(s);
	}

	static start(isoString?: string): void {
		DateMock.value = isoString ? new _realDate(isoString) : new _realDate();
		// @ts-ignore
		global.Date = DateMock;
	}

	static end(): void {
		global.Date = _realDate;
	}
}
