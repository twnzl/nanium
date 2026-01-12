
export enum LogLevel {
	none = 0,
	error = 1,
	warn = 2,
	info = 3,
}

export interface Logger {
	loglevel: LogLevel;

	info(...args: any[]): void;

	warn(...args: any[]): void;

	error(...args: any[]): void;
}

export class ConsoleLogger implements Logger {
	loglevel: LogLevel = LogLevel.none;
	includeTimestamp: boolean = true;

	constructor(level: LogLevel) {
		this.loglevel = level;
	}

	private trySerialize(arg: any): any {
		if (typeof arg === 'object') {
			try {
				return JSON.stringify(arg);
			} catch {
				;
			}
		}
		return arg;
	}

	private time(): string {
		return (this.includeTimestamp ? new Date().toISOString() + ': ' : '');
	}

	error(...args: any[]): void {
		if (this.loglevel >= LogLevel.error) {
			console.error(this.time() + 'nanium: ', ...args.map(a => {
				if (a?.message) {
					return a.message + a.stack;
				} else {
					return this.trySerialize(a);
				}
			}));
		}
	}

	warn(...args: any[]): void {
		if (this.loglevel >= LogLevel.warn) {
			console.warn(this.time() + 'nanium: ', ...args.map(a => {
				return this.trySerialize(a);
			}));
		}
	}

	info(...args: any[]): void {
		if (this.loglevel >= LogLevel.info) {
			console.log(this.time() + 'nanium: ', ...args.map(a => {
				return this.trySerialize(a);
			}));
		}
	}
}


export class NaniumLogger {
	private static loggers: Logger[] = [];

	static addLogger(logger: Logger): void {
		this.loggers.push(logger);
	}

	static info(...args: any[]): void {
		for (const logger of this.loggers) {
			logger.info(...args);
		}
	}

	static warn(...args: any[]): void {
		for (const logger of this.loggers) {
			logger.warn(...args);
		}
	}

	static error(...args: any[]): void {
		for (const logger of this.loggers) {
			logger.error(...args);
		}
	}
}