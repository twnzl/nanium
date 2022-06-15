import { TestBinaryRequest } from './binary.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { ServiceExecutor } from '../../../interfaces/serviceExecutor';
import { Buffer } from 'buffer';

export class TestBinaryExecutor implements ServiceExecutor<TestBinaryRequest, Buffer> {
	static serviceName: string = 'NaniumTest:test/binary';

	async execute(request: TestBinaryRequest, executionContext: ServiceRequestContext): Promise<Buffer> {
		return Buffer.from('Hello World!', 'utf8');
	}
}
