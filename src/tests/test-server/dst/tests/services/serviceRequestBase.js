var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ServiceRequestHead } from './serviceRequestHead.js';
import { Nanium } from '../../core.js';
import { NaniumObject, Type } from '../../objects.js';
export class ServiceRequestBase {
    // if body is not Partial<> here, typescript will complain if you do not set the properties of
    // functions and getters/setters
    constructor(body, head) {
        this.body = body ? NaniumObject.create(body, 'TRequestBody', this.constructor) : undefined;
        this.head = head ? new ServiceRequestHead(head) : undefined;
    }
    async execute(context) {
        return await Nanium.execute(this, undefined, context);
    }
    async enqueue(mandatorId, options) {
        const serviceName = this.constructor.serviceName;
        return await Nanium.enqueue({ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId });
    }
}
__decorate([
    Type(ServiceRequestHead),
    __metadata("design:type", ServiceRequestHead)
], ServiceRequestBase.prototype, "head", void 0);
__decorate([
    Type('TRequestBody'),
    __metadata("design:type", Object)
], ServiceRequestBase.prototype, "body", void 0);
//# sourceMappingURL=serviceRequestBase.js.map