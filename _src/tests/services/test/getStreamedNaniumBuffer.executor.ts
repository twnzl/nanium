import { TestGetStreamedNaniumBufferRequest } from './getStreamedNaniumBuffer.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';
import { NaniumBuffer } from '../../../interfaces/naniumBuffer';

export class TestGetStreamedNaniumBufferExecutor implements StreamServiceExecutor<TestGetStreamedNaniumBufferRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedNaniumBuffer';

	stream(request: TestGetStreamedNaniumBufferRequest, executionContext: ServiceRequestContext): Observable<NaniumBuffer> {
		return new Observable((observer: Observer<NaniumBuffer>): void => {
			observer.next(new NaniumBuffer(Float32Array.of(1, 2, 3)));
			setTimeout(() => observer.next(new NaniumBuffer(Float32Array.of(4, 5))), 500);
			setTimeout(() => observer.next(new NaniumBuffer(Float32Array.of(6, 7, 8, 9, 10))), 1000);
			setTimeout(() => observer.complete(), 1500);
		});
	}
}
