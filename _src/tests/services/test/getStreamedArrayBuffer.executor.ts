import { TestGetStreamedArrayBufferRequest } from './getStreamedArrayBuffer.contract';
import { TestExecutionContext } from '../testExecutionContext';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';

export class TestGetStreamedArrayBufferExecutor implements StreamServiceExecutor<TestGetStreamedArrayBufferRequest, Float32Array> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';

	stream(request: TestGetStreamedArrayBufferRequest, executionContext: TestExecutionContext): Observable<Float32Array> {
		return new Observable((observer: Observer<Float32Array>): void => {
			observer.next(Float32Array.of(1, 2, 3));
			setTimeout(() => observer.next(Float32Array.of(4, 5)), 500);
			setTimeout(() => observer.next(Float32Array.of(6, 7, 8, 9, 10)), 1000);
			setTimeout(() => observer.complete(), 1500);
		});
	}
}
