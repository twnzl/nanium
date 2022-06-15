import { Logger, LogLevel } from '../interfaces/logger';

export class TestLogger implements Logger {
	loglevel: LogLevel;

	errors: any[] = [];
	warnings: any[] = [];
	infos: any[] = [];

	constructor(level: LogLevel) {
		this.loglevel = level;
	}

	error(...args: any[]): void {
		if (this.loglevel >= LogLevel.error) {
			args.forEach(arg => this.errors.push(arg));
		}
	}

	warn(...args: any[]): void {
		if (this.loglevel >= LogLevel.warn) {
			args.forEach(arg => this.warnings.push(arg));
		}
	}

	info(...args: any[]): void {
		if (this.loglevel >= LogLevel.info) {
			args.forEach(arg => this.infos.push(arg));
		}
	}
}
