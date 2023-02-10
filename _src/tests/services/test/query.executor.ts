import { TestDto, TestQueryRequest } from './query.contract';
import { StreamServiceExecutor } from '../../../interfaces/streamServiceExecutor';
import { TestExecutionContext } from '../testExecutionContext';
import { Observable, Observer } from 'rxjs';

export class TestQueryExecutor implements StreamServiceExecutor<TestQueryRequest, TestDto> {
	static serviceName: string = 'NaniumTest:test/query';

	stream(request: TestQueryRequest, executionContext: TestExecutionContext): Observable<TestDto> {
		return new Observable((observer: Observer<TestDto>): void => {
			for (let i: number = 1; i < 1000; i++) {
				observer.next({ a: i.toString(), b: i } as TestDto);
			}
			observer.complete();
		});
	}
}

