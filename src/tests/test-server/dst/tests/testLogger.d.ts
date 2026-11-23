import { Logger, LogLevel } from '../interfaces/logger.js';
export declare class TestLogger implements Logger {
    loglevel: LogLevel;
    errors: any[][];
    warnings: any[][];
    infos: any[][];
    constructor(level: LogLevel);
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
}
