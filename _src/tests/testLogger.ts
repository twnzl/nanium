import { Logger, LogLevel } from '../interfaces/logger';

export class TestLogger implements Logger {
	loglevel: LogLevel;

	errors: any[][] = [];
	warnings: any[][] = [];
	infos: any[][] = [];

	constructor(level: LogLevel) {
		this.loglevel = level;
	}

	error(...args: any[]): void {
		if (this.loglevel >= LogLevel.error) {
			this.errors.push(args);
		}
	}

	warn(...args: any[]): void {
		if (this.loglevel >= LogLevel.warn) {
			this.warnings.push(args);
		}
	}

	info(...args: any[]): void {
		if (this.loglevel >= LogLevel.info) {
			this.infos.push(args);
		}
	}
}
