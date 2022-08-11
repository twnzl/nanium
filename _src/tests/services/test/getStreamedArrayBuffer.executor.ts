import { TestGetStreamedArrayBufferRequest } from './getStreamedArrayBuffer.contract';
import { ServiceRequestContext } from '../serviceRequestContext';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';

export class TestGetStreamedArrayBufferExecutor implements StreamServiceExecutor<TestGetStreamedArrayBufferRequest, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';

	stream(request: TestGetStreamedArrayBufferRequest, executionContext: ServiceRequestContext): Observable<ArrayBuffer> {
		return new Observable((observer: Observer<ArrayBuffer>): void => {
			const enc: TextEncoder = new TextEncoder();
			const buf: ArrayBuffer = enc.encode('This is a string converted to a Uint8Array');
			observer.next(buf.slice(0, 4));
			setTimeout(() => observer.next(buf.slice(4, 20)), 500);
			setTimeout(() => observer.next(buf.slice(20, buf.byteLength)), 1000);
			setTimeout(() => observer.complete(), 1500);
		});
	}
}
