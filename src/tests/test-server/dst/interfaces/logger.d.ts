export declare enum LogLevel {
    none = 0,
    error = 1,
    warn = 2,
    info = 3
}
export interface Logger {
    loglevel: LogLevel;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}
export declare class ConsoleLogger implements Logger {
    loglevel: LogLevel;
    includeTimestamp: boolean;
    constructor(level: LogLevel);
    private trySerialize;
    private time;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
}
export declare class NaniumLogger {
    private static loggers;
    static addLogger(logger: Logger): void;
    static info(...args: any[]): void;
    static warn(...args: any[]): void;
    static error(...args: any[]): void;
}
