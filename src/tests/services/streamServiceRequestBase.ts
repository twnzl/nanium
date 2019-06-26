import { ServiceRequestHead } from './serviceRequestHead';
import { Nocat } from '../..';
import { Observable } from 'rxjs';
import { StreamServiceRequest } from '../../interfaces/streamServiceRequest';

export class StreamServiceRequestBase<TRequestBody, TResult> implements StreamServiceRequest<TResult> {

	head: ServiceRequestHead;
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body;
		this.head = head;
	}

	execute(): Observable<TResult> {
		return Nocat.stream(this);
	}
}
