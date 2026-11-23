var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { NaniumObject, Type } from '../objects.js';
/**
 * each property can be a number, comma-separated numbers or a '*'
 * e.g.S
 * 	month: '1,4': each January an April
 * 	dayOfWeek: '1': each Monday
 * 	year: '*': each year
 * 	hour: '10': always at hour 10
 * 	minute: '5': always at minute 5
 * 	second: '0': always on second 0
 *
 * 	all this together means: each year on each Monday in January and April at 10:05:00
 *
 * 	skipping any property is the same as setting it to '*'
 */
export class CronConfig extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "second", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "minute", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "hour", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "dayOfMonth", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "month", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "dayOfWeek", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], CronConfig.prototype, "year", void 0);
//# sourceMappingURL=serviceRequestQueueEntry.js.map