import { TestDto, TestQueryRequest } from './query.contract';
import { Observable, Observer } from 'rxjs';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';

export default class TestQueryExecutor implements StreamServiceExecutor<TestQueryRequest, TestDto> {
	static serviceName: string = 'TestQuery';

	stream(request: TestQueryRequest): Observable<TestDto> {
		return new Observable((observer: Observer<TestDto>): void => {
			for (let i: number = 1; i < 4; i++) {
				observer.next({ a: i.toString(), b: i });
			}
			observer.complete();
		});
	}

}

