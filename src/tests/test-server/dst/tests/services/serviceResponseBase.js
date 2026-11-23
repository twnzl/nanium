var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { NaniumObject, Type } from '../../objects.js';
export class ServiceResponseMessage {
    constructor(code, text) {
        this.code = code;
        this.text = text;
    }
}
export class ServiceResponseHead extends NaniumObject {
}
__decorate([
    Type(ServiceResponseMessage),
    __metadata("design:type", Array)
], ServiceResponseHead.prototype, "errors", void 0);
__decorate([
    Type(ServiceResponseMessage),
    __metadata("design:type", Array)
], ServiceResponseHead.prototype, "exceptions", void 0);
export class ServiceResponseBase {
    constructor(body, head) {
        this.body = NaniumObject.create(body, 'TResponseBody', this.constructor);
        this.head = new ServiceResponseHead(head);
    }
    static createError(code, text) {
        return new ServiceResponseBase(undefined, {
            errors: [{
                    code: code,
                    text: text
                }]
        });
    }
}
__decorate([
    Type(ServiceResponseHead),
    __metadata("design:type", ServiceResponseHead)
], ServiceResponseBase.prototype, "head", void 0);
__decorate([
    Type('TResponseBody'),
    __metadata("design:type", Object)
], ServiceResponseBase.prototype, "body", void 0);
//# sourceMappingURL=serviceResponseBase.js.map