var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { NaniumObject, Type } from '../../../objects.js';
export class WsMessage extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], WsMessage.prototype, "type", void 0);
__decorate([
    Type('TContent'),
    __metadata("design:type", Object)
], WsMessage.prototype, "content", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Uint8Array)
], WsMessage.prototype, "payload", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Object)
], WsMessage.prototype, "error", void 0);
export class EmitEventMessageContent extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], EmitEventMessageContent.prototype, "eventName", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Object)
], EmitEventMessageContent.prototype, "event", void 0);
export class SubscribeEventMessageContent extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], SubscribeEventMessageContent.prototype, "eventName", void 0);
export class WsServiceRequestMessage extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], WsServiceRequestMessage.prototype, "id", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], WsServiceRequestMessage.prototype, "serviceName", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Object)
], WsServiceRequestMessage.prototype, "request", void 0);
export class WsServiceChunkMessage extends NaniumObject {
}
__decorate([
    Type(String),
    __metadata("design:type", String)
], WsServiceChunkMessage.prototype, "requestId", void 0);
__decorate([
    Type(Object),
    __metadata("design:type", Object)
], WsServiceChunkMessage.prototype, "response", void 0);
__decorate([
    Type(String),
    __metadata("design:type", String)
], WsServiceChunkMessage.prototype, "bufferOrStreamId", void 0);
__decorate([
    Type(Boolean),
    __metadata("design:type", Boolean)
], WsServiceChunkMessage.prototype, "isLastChunk", void 0);
__decorate([
    Type(Number),
    __metadata("design:type", Number)
], WsServiceChunkMessage.prototype, "totalBytes", void 0);
//# sourceMappingURL=ws.types.js.map