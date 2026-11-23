import { ServiceRequestBase } from '../../services/serviceRequestBase.js';
import { TestExecutionContext } from '../../services/testExecutionContext.js';
import { ServiceRequestInterceptor } from '../../../interfaces/serviceRequestInterceptor.js';
export declare class TestServerRequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
    execute(request: ServiceRequestBase<any, any>, context: TestExecutionContext): Promise<ServiceRequestBase<any, any>>;
    constructor();
}
