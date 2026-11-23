export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["none"] = 0] = "none";
    LogLevel[LogLevel["error"] = 1] = "error";
    LogLevel[LogLevel["warn"] = 2] = "warn";
    LogLevel[LogLevel["info"] = 3] = "info";
})(LogLevel || (LogLevel = {}));
export class ConsoleLogger {
    constructor(level) {
        this.loglevel = LogLevel.none;
        this.includeTimestamp = true;
        this.loglevel = level;
    }
    trySerialize(arg) {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            }
            catch {
                ;
            }
        }
        return arg;
    }
    time() {
        return (this.includeTimestamp ? new Date().toISOString() + ': ' : '');
    }
    error(...args) {
        if (this.loglevel >= LogLevel.error) {
            console.error(this.time() + 'nanium: ', ...args.map(a => {
                if (a?.message) {
                    return a.message + a.stack;
                }
                else {
                    return this.trySerialize(a);
                }
            }));
        }
    }
    warn(...args) {
        if (this.loglevel >= LogLevel.warn) {
            console.warn(this.time() + 'nanium: ', ...args.map(a => {
                return this.trySerialize(a);
            }));
        }
    }
    info(...args) {
        if (this.loglevel >= LogLevel.info) {
            console.log(this.time() + 'nanium: ', ...args.map(a => {
                return this.trySerialize(a);
            }));
        }
    }
}
export class NaniumLogger {
    static { this.loggers = []; }
    static addLogger(logger) {
        this.loggers.push(logger);
    }
    static info(...args) {
        for (const logger of this.loggers) {
            logger.info(...args);
        }
    }
    static warn(...args) {
        for (const logger of this.loggers) {
            logger.warn(...args);
        }
    }
    static error(...args) {
        for (const logger of this.loggers) {
            logger.error(...args);
        }
    }
}
//# sourceMappingURL=logger.js.map