import { Observable } from 'rxjs';

export interface StreamServiceRequest<TResult> {
	execute(): Observable<TResult>;
}
