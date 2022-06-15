import { TestBinaryStreamRequest } from './binaryStream.contract';
import { Observable, Observer } from 'rxjs';
import { ServiceRequestContext } from '../serviceRequestContext';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';
import { Buffer } from 'buffer';

export class TestBinaryStreamExecutor implements StreamServiceExecutor<TestBinaryStreamRequest, Buffer> {
	static serviceName: string = 'NaniumTest:test/binaryStream';

	stream(request: TestBinaryStreamRequest, executionContext: ServiceRequestContext): Observable<Buffer> {
		return new Observable((observer: Observer<Buffer>): void => {
			observer.next(Buffer.from('Hello', 'utf8'));
			observer.next(Buffer.from(' ', 'utf8'));
			observer.next(Buffer.from('World', 'utf8'));
			observer.next(Buffer.from('!', 'utf8'));
			observer.complete();
		});
	}
}
