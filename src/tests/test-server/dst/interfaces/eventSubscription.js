var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Nanium } from '../core.js';
import { Type } from '../objects.js';
export class EventSubscription {
    static { this.nextId = 0; }
    constructor(clientId, eventName, handler, additionalData) {
        this.id = EventSubscription.nextId++;
        this.clientId = clientId;
        this.eventName = eventName;
        this.handler = handler;
        this.additionalData = additionalData;
    }
    async unsubscribe() {
        await Nanium.unsubscribe(this);
    }
}
__decorate([
    Type(Number),
    __metadata("design:type", Number)
], EventSubscription.prototype, "id", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], EventSubscription.prototype, "clientId", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Object)
], EventSubscription.prototype, "context", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], EventSubscription.prototype, "eventName", void 0);
__decorate([
    Type('TData'),
    __metadata("design:type", Object)
], EventSubscription.prototype, "additionalData", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], EventSubscription.prototype, "channelId", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], EventSubscription.prototype, "source", void 0);
//# sourceMappingURL=eventSubscription.js.map