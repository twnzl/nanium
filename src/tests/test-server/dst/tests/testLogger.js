import { LogLevel } from '../interfaces/logger.js';
export class TestLogger {
    constructor(level) {
        this.errors = [];
        this.warnings = [];
        this.infos = [];
        this.loglevel = level;
    }
    error(...args) {
        if (this.loglevel >= LogLevel.error) {
            this.errors.push(args);
        }
    }
    warn(...args) {
        if (this.loglevel >= LogLevel.warn) {
            this.warnings.push(args);
        }
    }
    info(...args) {
        if (this.loglevel >= LogLevel.info) {
            this.infos.push(args);
        }
    }
}
//# sourceMappingURL=testLogger.js.map