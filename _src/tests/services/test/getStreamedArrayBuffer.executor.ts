import { TestGetStreamedArrayBufferRequest } from './getStreamedArrayBuffer.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';

export class TestGetStreamedArrayBufferExecutor implements StreamServiceExecutor<TestGetStreamedArrayBufferRequest, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';

	stream(request: TestGetStreamedArrayBufferRequest, executionContext: ServiceRequestContext): Observable<ArrayBuffer> {
		return new Observable((observer: Observer<ArrayBuffer>): void => {
			observer.next(Float32Array.of(1, 2, 3));
			setTimeout(() => observer.next(Float32Array.of(4, 5)), 500);
			setTimeout(() => observer.next(Float32Array.of(6, 7, 8, 9, 10)), 1000);
			setTimeout(() => observer.complete(), 1500);
		});
	}
}
