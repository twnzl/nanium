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

